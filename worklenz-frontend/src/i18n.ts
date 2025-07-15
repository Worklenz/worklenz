import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpApi from 'i18next-http-backend';

i18n
  .use(HttpApi)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    defaultNS: 'common',
    
    interpolation: {
      escapeValue: false,
    },
    
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    
    debug: process.env.NODE_ENV === 'development',
    
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
      // Ensure translations are loaded synchronously
      crossDomain: false,
      withCredentials: false,
    },
    
    react: {
      useSuspense: false,
    },
    
    // Ensure all namespaces are loaded upfront
    ns: ['common', 'home', 'task-management', 'task-list-table'],
    
    // Add initialization promise to ensure translations are loaded
    initImmediate: false,
  });

// Ensure translations are loaded before the app starts
i18n.on('initialized', () => {
  console.log('i18n initialized successfully');
});

i18n.on('loaded', (loaded) => {
  console.log('i18n loaded:', loaded);
});

i18n.on('failedLoading', (lng, ns, msg) => {
  console.error('i18n failed loading:', lng, ns, msg);
});

export default i18n;
