import { ILanguageType, Language } from '@/features/i18n/localesSlice';

const STORAGE_KEY = 'i18nextLng';

/**
 * Gets the user's browser language and returns it if supported, otherwise returns English
 * @returns The detected supported language or English as fallback
 */
export const getDefaultLanguage = (): ILanguageType => {
  const browserLang = navigator.language.split('-')[0];
  if (Object.values(Language).includes(browserLang as Language)) {
    return browserLang as ILanguageType;
  }
  return Language.EN;
};

export const DEFAULT_LANGUAGE: ILanguageType = getDefaultLanguage();

/**
 * Gets the current language from local storage
 * @returns The stored language or default language if not found
 */
export const getLanguageFromLocalStorage = (): ILanguageType => {
  const savedLng = localStorage.getItem(STORAGE_KEY);
  if (Object.values(Language).includes(savedLng as Language)) {
    return savedLng as ILanguageType;
  }
  return DEFAULT_LANGUAGE;
};

/**
 * Saves the current language to local storage
 * @param lng Language to save
 */
export const saveLanguageInLocalStorage = (lng: ILanguageType): void => {
  localStorage.setItem(STORAGE_KEY, lng);
};
