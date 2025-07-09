import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpApi from 'i18next-http-backend';
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

// Cache to track loaded translations and prevent duplicate requests
const loadedTranslations = new Set<string>();
const loadingPromises = new Map<string, Promise<any>>();

// Background loading queue for non-essential translations
let backgroundLoadingQueue: Array<{ lang: string; ns: string }> = [];
let isBackgroundLoading = false;

i18n
  .use(HttpApi)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
      // Add request timeout to prevent hanging on slow connections
      requestOptions: {
        cache: 'default',
        mode: 'cors',
        credentials: 'same-origin',
      },
    },
    defaultNS: 'common',
    // Only load essential namespaces initially
    ns: ESSENTIAL_NAMESPACES,
    interpolation: {
      escapeValue: false,
    },
    // Only preload current language to reduce initial load
    preload: [],
    load: 'languageOnly',
    // Disable loading all namespaces on init
    initImmediate: false,
    // Cache translations with shorter expiration for better performance
    cache: {
      enabled: true,
      expirationTime: 12 * 60 * 60 * 1000, // 12 hours
    },
    // Reduce debug output in production
    debug: process.env.NODE_ENV === 'development',
  });

// Optimized function to ensure translations are loaded
export const ensureTranslationsLoaded = async (
  namespaces: string[] = ESSENTIAL_NAMESPACES,
  languages: string[] = [i18n.language || 'en']
) => {
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

        // Create loading promise
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
              resolve();
            } catch (error) {
              logger.error(`Failed to load namespace: ${ns} for language: ${lang}`, error);
              reject(error);
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
    return true;
  } catch (error) {
    logger.error('Failed to load translations:', error);
    return false;
  }
};

// Background loading function for non-essential translations
const processBackgroundQueue = async () => {
  if (isBackgroundLoading || backgroundLoadingQueue.length === 0) return;
  
  isBackgroundLoading = true;
  
  try {
    // Process queue in batches to avoid overwhelming the network
    const batchSize = 3;
    while (backgroundLoadingQueue.length > 0) {
      const batch = backgroundLoadingQueue.splice(0, batchSize);
      const batchPromises = batch.map(({ lang, ns }) => 
                 ensureTranslationsLoaded([ns], [lang]).catch(error => {
           logger.error(`Background loading failed for ${lang}:${ns}`, error);
         })
      );
      
      await Promise.all(batchPromises);
      
      // Add small delay between batches to prevent blocking
      if (backgroundLoadingQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  } finally {
    isBackgroundLoading = false;
  }
};

// Queue secondary translations for background loading
const queueSecondaryTranslations = (language: string) => {
  SECONDARY_NAMESPACES.forEach(ns => {
    const key = `${language}:${ns}`;
    if (!loadedTranslations.has(key)) {
      backgroundLoadingQueue.push({ lang: language, ns });
    }
  });
  
  // Start background loading with a delay to not interfere with initial render
  setTimeout(processBackgroundQueue, 2000);
};

// Initialize only essential translations for current language
const initializeTranslations = async () => {
  try {
    const currentLang = i18n.language || 'en';
    
    // Load only essential namespaces initially
    await ensureTranslationsLoaded(ESSENTIAL_NAMESPACES, [currentLang]);
    
    // Queue secondary translations for background loading
    queueSecondaryTranslations(currentLang);
    
    return true;
  } catch (error) {
    logger.error('Failed to initialize translations:', error);
    return false;
  }
};

// Language change handler that prioritizes essential namespaces
export const changeLanguageOptimized = async (language: string) => {
  try {
    // Change language first
    await i18n.changeLanguage(language);
    
    // Load essential namespaces immediately
    await ensureTranslationsLoaded(ESSENTIAL_NAMESPACES, [language]);
    
    // Queue secondary translations for background loading
    queueSecondaryTranslations(language);
    
    return true;
  } catch (error) {
    logger.error(`Failed to change language to ${language}:`, error);
    return false;
  }
};

// Initialize translations on app startup (only essential ones)
initializeTranslations();

export default i18n;
