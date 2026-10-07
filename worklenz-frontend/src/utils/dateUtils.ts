import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import 'dayjs/locale/de';
import 'dayjs/locale/es';
import 'dayjs/locale/pt';
import 'dayjs/locale/sq';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/pl';
import 'dayjs/locale/fr';
import i18n from '@/i18n';
import { getLanguageFromLocalStorage } from './language-utils';

// Initialize plugins
dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);

// Map application languages to dayjs locales
const getLocaleFromLanguage = (language?: string): string => {
  if (!language) return 'en';
  const normalized = language.toLowerCase().trim();
  const localeMap: Record<string, string> = {
    en: 'en',
    de: 'de',
    es: 'es',
    pt: 'pt',
    alb: 'sq',
    sq: 'sq',
    zh: 'zh-cn',
    zh_cn: 'zh-cn',
    'zh-cn': 'zh-cn',
    pl: 'pl',
    fr: 'fr',
  };
  return (
    localeMap[normalized] ||
    localeMap[normalized.replace('-', '_')] ||
    localeMap[normalized.split(/[-_]/)[0]] ||
    'en'
  );
};

/**
 * Returns the English weekday name (e.g. "Monday") for a date, independent of the
 * app's currently active dayjs GLOBAL locale (see ThemeWrapper.tsx, which calls
 * dayjs.locale(lng) app-wide on every language change). Use this whenever a
 * formatted weekday string is compared against English day-name data (e.g. org
 * "working days" settings) — never use bare date.format('dddd') for that comparison,
 * since it silently breaks under any non-English locale. See issue #1994.
 */
export const getEnglishWeekdayName = (date: dayjs.Dayjs): string =>
  date.locale('en').format('dddd');

/**
 * Formats a date to a relative time string (e.g., "2 hours ago", "a day ago")
 * This mimics the Angular fromNow pipe functionality with locale support
 *
 * @param date - The date to format (string, Date, or dayjs object)
 * @param language - Optional language override (defaults to active or stored language)
 * @returns A string representing the relative time
 */
export const fromNow = (date: string | Date | dayjs.Dayjs, language?: string): string => {
  if (!date) return '';
  const currentLanguage =
    language || (typeof i18n !== 'undefined' && i18n?.language) || getLanguageFromLocalStorage();
  const locale = getLocaleFromLanguage(currentLanguage);
  return dayjs(date).locale(locale).fromNow();
};

/**
 * Formats a date to a specific format with locale support
 *
 * @param date - The date to format (string, Date, or dayjs object)
 * @param format - The format string (default: 'YYYY-MM-DD')
 * @param language - Optional language override (defaults to active or stored language)
 * @returns A formatted date string
 */
export const formatDate = (
  date: string | Date | dayjs.Dayjs,
  format: string = 'YYYY-MM-DD',
  language?: string
): string => {
  if (!date) return '';
  const currentLanguage =
    language || (typeof i18n !== 'undefined' && i18n?.language) || getLanguageFromLocalStorage();
  const locale = getLocaleFromLanguage(currentLanguage);
  return dayjs(date).locale(locale).format(format);
};
