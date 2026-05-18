import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpApi from 'i18next-http-backend';

const normalizeDetectedLanguage = (language: string): string => {
  const normalizedLanguage = language.trim().toLowerCase();
  const zhTwAliases = ['zh-tw', 'zh_tw', 'zh-hant', 'zh_hant', 'zh-hant-tw', 'zh_hant_tw'];

  return zhTwAliases.includes(normalizedLanguage) ? 'zh_tw' : language;
};

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
      convertDetectedLanguage: normalizeDetectedLanguage,
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
