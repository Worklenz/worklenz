import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpApi from 'i18next-http-backend';
import logger from './utils/errorLogger';

// Essential namespaces that should be preloaded to prevent Suspense
const ESSENTIAL_NAMESPACES = [
  'common',
  'tasks/task-table-bulk-actions',
  'task-management',
  'auth/login',
  'settings',
];

// Cache to track loaded translations and prevent duplicate requests
const loadedTranslations = new Set<string>();
const loadingPromises = new Map<string, Promise<any>>();

i18n
  .use(HttpApi)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    defaultNS: 'common',
    ns: ESSENTIAL_NAMESPACES,
    interpolation: {
      escapeValue: false,
    },
    // Preload essential namespaces
    preload: ['en', 'es', 'pt', 'alb', 'de'],
    // Load all namespaces on initialization
    load: 'languageOnly',
    // Cache translations
    cache: {
      enabled: true,
      expirationTime: 24 * 60 * 60 * 1000, // 24 hours
    },
  });

// Utility function to ensure translations are loaded
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
          // Switch to the target language temporarily if needed
          const currentLang = i18n.language;
          const shouldSwitchLang = currentLang !== lang;
          
          const loadForLanguage = async () => {
            try {
              if (shouldSwitchLang) {
                await i18n.changeLanguage(lang);
              }
              
              await i18n.loadNamespaces(ns);
              
              // Switch back to original language if we changed it
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

    // Wait for all loading promises to complete
    await Promise.all(loadPromises);
    return true;
  } catch (error) {
    logger.error('Failed to load translations:', error);
    return false;
  }
};

// Preload essential translations for current language only on startup
const initializeTranslations = async () => {
  const currentLang = i18n.language || 'en';
  await ensureTranslationsLoaded(ESSENTIAL_NAMESPACES, [currentLang]);
};

// Initialize translations on app startup (only once)
initializeTranslations();

export default i18n;
