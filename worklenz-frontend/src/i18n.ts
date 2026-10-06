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
    ns: ['common', 'home', 'task-drawer/task-drawer'], // Preload namespaces used on first paint

    interpolation: {
      escapeValue: false,
    },

    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },

    debug: false,

    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },

    react: {
      useSuspense: false,
    },

    // Surface missing/unresolved keys in dev so a broken or incomplete namespace
    // (e.g. malformed JSON, a key removed from one locale but not another) shows
    // up in the console instead of silently rendering the raw key in the UI.
    saveMissing: import.meta.env.DEV,
    missingKeyHandler: import.meta.env.DEV
      ? (lngs, ns, key) => {
          console.warn(`[i18n] Missing key "${key}" in namespace "${ns}" for language(s): ${lngs.join(', ')}`);
        }
      : undefined,
  });

export default i18n;
