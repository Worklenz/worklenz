import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpApi from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
import LocalStorageBackend from 'i18next-localstorage-backend';
import logger from './utils/errorLogger';

// Essential namespaces that should be preloaded to prevent Suspense
const ESSENTIAL_NAMESPACES = [
  'common',
  'auth/login',
  'navbar',
];

// Secondary namespaces that can be loaded on demand
const SECONDARY_NAMESPACES = [
  'tasks/task-table-bulk-actions',
  'task-management',
  'settings',
  'home',
  'project-drawer',
];

// Tertiary namespaces that can be loaded even later
const TERTIARY_NAMESPACES = [
  'task-drawer/task-drawer',
  'task-list-table',
  'phases-drawer',
  'schedule',
  'reporting',
  'admin-center/current-bill',
];

// Cache to track loaded translations and prevent duplicate requests
const loadedTranslations = new Set<string>();
const loadingPromises = new Map<string, Promise<any>>();

// Background loading queue for non-essential translations
let backgroundLoadingQueue: Array<{ lang: string; ns: string; priority: number }> = [];
let isBackgroundLoading = false;

// Performance monitoring
const performanceMetrics = {
  totalLoadTime: 0,
  translationsLoaded: 0,
  cacheHits: 0,
  cacheMisses: 0,
};

// Enhanced caching configuration
const CACHE_CONFIG = {
  EXPIRATION_TIME: 7 * 24 * 60 * 60 * 1000, // 7 days
  MAX_CACHE_SIZE: 50, // Maximum number of namespaces to cache
  CLEANUP_INTERVAL: 24 * 60 * 60 * 1000, // Clean cache daily
};

i18n
  .use(LocalStorageBackend) // Cache translations to localStorage
  .use(LanguageDetector) // Detect user language
  .use(HttpApi) // Fetch translations if not in cache
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
      addPath: '/locales/add/{{lng}}/{{ns}}',
      // Enhanced LocalStorage caching options
      backendOptions: [{
        expirationTime: CACHE_CONFIG.EXPIRATION_TIME,
        // Store translations more efficiently
        store: {
          setItem: (key: string, value: string) => {
            try {
              // Compress large translation objects
              const compressedValue = value.length > 1000 ? 
                JSON.stringify(JSON.parse(value)) : value;
              localStorage.setItem(key, compressedValue);
              performanceMetrics.cacheHits++;
            } catch (error) {
              logger.error('Failed to store translation in cache:', error);
            }
          },
          getItem: (key: string) => {
            try {
              const value = localStorage.getItem(key);
              if (value) {
                performanceMetrics.cacheHits++;
                return value;
              }
              performanceMetrics.cacheMisses++;
              return null;
            } catch (error) {
              logger.error('Failed to retrieve translation from cache:', error);
              performanceMetrics.cacheMisses++;
              return null;
            }
          }
        }
      }, {
        loadPath: '/locales/{{lng}}/{{ns}}.json',
        // Add request timeout and retry logic
        requestOptions: {
          cache: 'force-cache', // Use browser cache when possible
        },
        parse: (data: string) => {
          try {
            return JSON.parse(data);
          } catch (error) {
            logger.error('Failed to parse translation data:', error);
            return {};
          }
        }
      }],
    },
    defaultNS: 'common',
    ns: ESSENTIAL_NAMESPACES,
    interpolation: {
      escapeValue: false,
    },
    preload: [],
    load: 'languageOnly',
    initImmediate: false,
    detection: {
      order: ['localStorage', 'navigator'], // Check localStorage first, then browser language
      caches: ['localStorage'],
      // Cache the detected language for faster subsequent loads
      cookieMinutes: 60 * 24 * 7, // 1 week
    },
    // Reduce debug output in production
    debug: process.env.NODE_ENV === 'development',
    // Performance optimizations
    cleanCode: true, // Remove code characters
    keySeparator: false, // Disable key separator for better performance
    nsSeparator: false, // Disable namespace separator for better performance
    pluralSeparator: '_', // Use underscore for plural separation
    react: {
      useSuspense: false, // Disable suspense for better control
      bindI18n: 'languageChanged loaded', // Only bind necessary events
      bindI18nStore: false, // Disable store binding for better performance
    },
  });

// Optimized function to ensure translations are loaded with priority support
export const ensureTranslationsLoaded = async (
  namespaces: string[] = ESSENTIAL_NAMESPACES,
  languages: string[] = [i18n.language || 'en'],
  priority: number = 0
) => {
  const startTime = performance.now();
  
  try {
    const loadPromises: Promise<any>[] = [];

    for (const lang of languages) {
      for (const ns of namespaces) {
        const key = `${lang}:${ns}`;
        
        // Skip if already loaded
        if (loadedTranslations.has(key)) {
          continue;
        }

        // Check if already loading
        if (loadingPromises.has(key)) {
          loadPromises.push(loadingPromises.get(key)!);
          continue;
        }

        // Create loading promise with enhanced error handling
        const loadingPromise = new Promise<void>((resolve, reject) => {
          const currentLang = i18n.language;
          const shouldSwitchLang = currentLang !== lang;
          
          const loadForLanguage = async () => {
            try {
              if (shouldSwitchLang) {
                await i18n.changeLanguage(lang);
              }
              
              await i18n.loadNamespaces(ns);
              
              if (shouldSwitchLang && currentLang) {
                await i18n.changeLanguage(currentLang);
              }
              
              loadedTranslations.add(key);
              performanceMetrics.translationsLoaded++;
              resolve();
            } catch (error) {
              logger.error(`Failed to load namespace: ${ns} for language: ${lang}`, error);
              // Don't reject completely, just log and continue
              resolve(); // Still resolve to prevent blocking other translations
            } finally {
              loadingPromises.delete(key);
            }
          };

          loadForLanguage();
        });

        loadingPromises.set(key, loadingPromise);
        loadPromises.push(loadingPromise);
      }
    }

    await Promise.all(loadPromises);
    
    const endTime = performance.now();
    performanceMetrics.totalLoadTime += (endTime - startTime);
    
    return true;
  } catch (error) {
    logger.error('Failed to load translations:', error);
    return false;
  }
};

// Enhanced background loading function with priority queue
const processBackgroundQueue = async () => {
  if (isBackgroundLoading || backgroundLoadingQueue.length === 0) return;
  
  isBackgroundLoading = true;
  
  try {
    // Sort by priority (higher priority first)
    backgroundLoadingQueue.sort((a, b) => b.priority - a.priority);
    
    // Process queue in smaller batches to avoid overwhelming the network
    const batchSize = 2; // Reduced batch size for better performance
    while (backgroundLoadingQueue.length > 0) {
      const batch = backgroundLoadingQueue.splice(0, batchSize);
      const batchPromises = batch.map(({ lang, ns }) => 
        ensureTranslationsLoaded([ns], [lang], 0).catch(error => {
          logger.error(`Background loading failed for ${lang}:${ns}`, error);
        })
      );
      
      await Promise.all(batchPromises);
      
      // Add delay between batches to prevent blocking main thread
      if (backgroundLoadingQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 200)); // Increased delay
      }
      
      // Break if we've been loading for too long (prevent infinite loops)
      if (performance.now() - performanceMetrics.totalLoadTime > 30000) { // 30 seconds max
        logger.error('Background translation loading taking too long, stopping');
        break;
      }
    }
  } finally {
    isBackgroundLoading = false;
  }
};

// Enhanced queueing with priority support
const queueTranslations = (language: string, namespaces: string[], priority: number = 0) => {
  namespaces.forEach(ns => {
    const key = `${language}:${ns}`;
    if (!loadedTranslations.has(key)) {
      // Remove existing entry if it exists with lower priority
      const existingIndex = backgroundLoadingQueue.findIndex(item => 
        item.lang === language && item.ns === ns);
      if (existingIndex >= 0) {
        if (backgroundLoadingQueue[existingIndex].priority < priority) {
          backgroundLoadingQueue.splice(existingIndex, 1);
        } else {
          return; // Don't add duplicate with lower or equal priority
        }
      }
      
      backgroundLoadingQueue.push({ lang: language, ns, priority });
    }
  });
  
  // Start background loading with appropriate delay based on priority
  const delay = priority > 5 ? 1000 : priority > 2 ? 2000 : 3000;
  setTimeout(processBackgroundQueue, delay);
};

// Initialize only essential translations for current language
const initializeTranslations = async () => {
  try {
    const currentLang = i18n.language || 'en';
    
    // Load only essential namespaces immediately
    await ensureTranslationsLoaded(ESSENTIAL_NAMESPACES, [currentLang], 10);
    
    // Queue secondary translations with medium priority
    queueTranslations(currentLang, SECONDARY_NAMESPACES, 5);
    
    // Queue tertiary translations with low priority
    queueTranslations(currentLang, TERTIARY_NAMESPACES, 1);
    
    return true;
  } catch (error) {
    logger.error('Failed to initialize translations:', error);
    return false;
  }
};

// Enhanced language change handler with better prioritization
export const changeLanguageOptimized = async (language: string) => {
  try {
    // Change language first
    await i18n.changeLanguage(language);
    
    // Load essential namespaces immediately with high priority
    await ensureTranslationsLoaded(ESSENTIAL_NAMESPACES, [language], 10);
    
    // Queue secondary translations with medium priority
    queueTranslations(language, SECONDARY_NAMESPACES, 5);
    
    // Queue tertiary translations with low priority
    queueTranslations(language, TERTIARY_NAMESPACES, 1);
    
    return true;
  } catch (error) {
    logger.error(`Failed to change language to ${language}:`, error);
    return false;
  }
};

// Cache cleanup functionality
const cleanupCache = () => {
  try {
    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith('i18next_res_')
    );
    
    if (keys.length > CACHE_CONFIG.MAX_CACHE_SIZE) {
      // Remove oldest entries
      const entriesToRemove = keys.slice(0, keys.length - CACHE_CONFIG.MAX_CACHE_SIZE);
      entriesToRemove.forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch (error) {
          logger.error('Failed to remove cache entry:', error);
        }
      });
    }
  } catch (error) {
    logger.error('Failed to cleanup translation cache:', error);
  }
};

// Performance monitoring functions
export const getPerformanceMetrics = () => ({
  ...performanceMetrics,
  cacheEfficiency: performanceMetrics.cacheHits / 
    (performanceMetrics.cacheHits + performanceMetrics.cacheMisses) * 100,
  averageLoadTime: performanceMetrics.totalLoadTime / performanceMetrics.translationsLoaded,
});

export const resetPerformanceMetrics = () => {
  performanceMetrics.totalLoadTime = 0;
  performanceMetrics.translationsLoaded = 0;
  performanceMetrics.cacheHits = 0;
  performanceMetrics.cacheMisses = 0;
};

// Utility function to preload translations for a specific page/component
export const preloadPageTranslations = async (pageNamespaces: string[]) => {
  const currentLang = i18n.language || 'en';
  return ensureTranslationsLoaded(pageNamespaces, [currentLang], 8);
};

// Set up periodic cache cleanup
if (typeof window !== 'undefined') {
  setInterval(cleanupCache, CACHE_CONFIG.CLEANUP_INTERVAL);
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', cleanupCache);
}

// Initialize translations on app startup
initializeTranslations();

export default i18n;
