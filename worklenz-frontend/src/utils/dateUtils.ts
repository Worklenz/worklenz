import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import 'dayjs/locale/de';
import 'dayjs/locale/es';
import 'dayjs/locale/pt';
import 'dayjs/locale/zh-cn';
import { getLanguageFromLocalStorage } from './language-utils';

// Initialize plugins
dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);

// Map application languages to dayjs locales
const getLocaleFromLanguage = (language: string): string => {
  const localeMap: Record<string, string> = {
    en: 'en',
    de: 'de',
    es: 'es',
    pt: 'pt',
    alb: 'en', // Albanian not supported by dayjs, fallback to English
    zh: 'zh-cn',
  };
  return localeMap[language] || 'en';
};

/**
 * Formats a date to a relative time string (e.g., "2 hours ago", "a day ago")
 * This mimics the Angular fromNow pipe functionality with locale support
 *
 * @param date - The date to format (string, Date, or dayjs object)
 * @param language - Optional language override (defaults to stored language)
 * @returns A string representing the relative time
 */
export const fromNow = (date: string | Date | dayjs.Dayjs, language?: string): string => {
  if (!date) return '';
  const currentLanguage = language || getLanguageFromLocalStorage();
  const locale = getLocaleFromLanguage(currentLanguage);
  return dayjs(date).locale(locale).fromNow();
};

/**
 * Formats a date to a specific format with locale support
 *
 * @param date - The date to format (string, Date, or dayjs object)
 * @param format - The format string (default: 'YYYY-MM-DD')
 * @param language - Optional language override (defaults to stored language)
 * @returns A formatted date string
 */
export const formatDate = (
  date: string | Date | dayjs.Dayjs,
  format: string = 'YYYY-MM-DD',
  language?: string
): string => {
  if (!date) return '';
  const currentLanguage = language || getLanguageFromLocalStorage();
  const locale = getLocaleFromLanguage(currentLanguage);
  return dayjs(date).locale(locale).format(format);
};
