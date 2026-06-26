import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import i18n from '../../i18n';

export enum Language {
  EN = 'en',
  ES = 'es',
  PT = 'pt',
  ALB = 'alb',
  DE = 'de',
  ZH = 'zh_cn',
}

export type ILanguageType = `${Language}`;

type LocalesState = {
  lng: ILanguageType;
};

const STORAGE_KEY = 'i18nextLng';

/**
 * Gets the user's browser language and returns it if supported, otherwise returns English
 * @returns The detected supported language or English as fallback
 */
const getDefaultLanguage = (): ILanguageType => {
  const browserLang = navigator.language.split('-')[0];
  if (Object.values(Language).includes(browserLang as Language)) {
    return browserLang as ILanguageType;
  }
  return Language.EN;
};

const DEFAULT_LANGUAGE: ILanguageType = getDefaultLanguage();

/**
 * Gets the current language from local storage
 * @returns The stored language or default language if not found
 */
const getLanguageFromLocalStorage = (): ILanguageType => {
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
const saveLanguageInLocalStorage = (lng: ILanguageType): void => {
  localStorage.setItem(STORAGE_KEY, lng);
};

/**
 * Applies a language from the authenticated user's profile.
 * Called after login or session verification to restore the
 * user's server-saved language preference.
 * @param userLang Language string coming from the user profile API response
 */
export const applyLanguageFromUser = (userLang: string): void => {
  if (Object.values(Language).includes(userLang as Language)) {
    localStorage.setItem(STORAGE_KEY, userLang);
    i18n.changeLanguage(userLang as ILanguageType);
  }
};

const initialState: LocalesState = {
  lng: getLanguageFromLocalStorage(),
};

const localesSlice = createSlice({
  name: 'localesReducer',
  initialState,
  reducers: {
    toggleLng: state => {
      const newLang: ILanguageType = state.lng === Language.EN ? Language.ES : Language.EN;
      state.lng = newLang;
      saveLanguageInLocalStorage(newLang);
      i18n.changeLanguage(newLang);
    },
    setLanguage: (state, action: PayloadAction<ILanguageType>) => {
      state.lng = action.payload;
      saveLanguageInLocalStorage(action.payload);
      i18n.changeLanguage(action.payload);
    },
  },
});

export const { toggleLng, setLanguage } = localesSlice.actions;
export default localesSlice.reducer;