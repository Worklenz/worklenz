import { ILanguageType, Language } from '@/features/i18n/localesSlice';

const STORAGE_KEY = 'i18nextLng';

/**
 * Normalizes any language code string to a supported ILanguageType or null
 */
export const normalizeLanguage = (lang?: string | null): ILanguageType | null => {
  if (!lang) return null;
  const lower = lang.toLowerCase().trim();
  if (lower === 'zh_cn' || lower === 'zh-cn' || lower === 'zh') return Language.ZH;
  if (lower === 'alb' || lower === 'sq') return Language.ALB;
  const base = lower.split(/[-_]/)[0];
  const matched = Object.values(Language).find(l => l === lower || l === base);
  return matched ? (matched as ILanguageType) : null;
};

/**
 * Gets the user's browser language and returns it if supported, otherwise returns English
 * @returns The detected supported language or English as fallback
 */
export const getDefaultLanguage = (): ILanguageType => {
  const browserLang = navigator.language;
  const normalized = normalizeLanguage(browserLang);
  if (normalized) {
    return normalized;
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
  const normalized = normalizeLanguage(savedLng);
  if (normalized) {
    return normalized;
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

