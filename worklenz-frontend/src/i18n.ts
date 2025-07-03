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
export const ensureTranslationsLoaded = async (namespaces: string[] = ESSENTIAL_NAMESPACES) => {
  const currentLang = i18n.language || 'en';

  try {
    // Load all essential namespaces for the current language
    await Promise.all(
      namespaces.map(ns =>
        i18n.loadNamespaces(ns).catch(() => {
          logger.error(`Failed to load namespace: ${ns}`);
        })
      )
    );

    // Also preload for other languages to prevent delays on language switch
    const otherLangs = ['en', 'es', 'pt', 'alb', 'de'].filter(lang => lang !== currentLang);
    await Promise.all(
      otherLangs.map(lang =>
        Promise.all(
          namespaces.map(ns =>
            i18n.loadNamespaces(ns).catch(() => {
              logger.error(`Failed to load namespace: ${ns}`);
            })
          )
        )
      )
    );

    return true;
  } catch (error) {
    logger.error('Failed to load translations:', error);
    return false;
  }
};

// Initialize translations on app startup
ensureTranslationsLoaded();

export default i18n;
