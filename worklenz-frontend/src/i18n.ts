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
    ns: ['common', 'home'], // Preload home namespace

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
    },

    react: {
      useSuspense: false,
    },
  });

export default i18n;
