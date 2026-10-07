// Build metadata shown in Settings > Help > About. The version itself comes
// from getAppVersion() in '@/config/env'.

// The app's language codes are not all valid BCP 47 tags: 'alb' is Albanian
// (sq) and Chinese is stored as 'zh' / 'zh_cn'.
const INTL_LOCALE_BY_APP_LANGUAGE: Record<string, string> = {
  alb: 'sq',
  zh: 'zh-CN',
  zh_cn: 'zh-CN',
};

const FALLBACK_LOCALE = 'en';

/**
 * When the running bundle was built, from the `__BUILD_TIMESTAMP__` constant
 * that vite.config.ts injects. Guarded with `typeof` because the constant does
 * not exist under vitest (separate vitest.config.ts) or in any tool that loads
 * the source without Vite's `define`.
 * @returns the build date, or null when it is unavailable or unparseable
 */
export const getBuildDate = (): Date | null => {
  if (typeof __BUILD_TIMESTAMP__ === 'undefined') return null;

  const timestamp = Number(__BUILD_TIMESTAMP__);
  if (!Number.isFinite(timestamp)) return null;

  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Formats a date as a long, localized date (e.g. "September 3, 2026") in the
 * user's app language. Language and Region only stores language and timezone,
 * so the app language is the closest thing to a "user locale" to honour.
 */
export const formatBuildDate = (date: Date, language: string): string => {
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
  const locale = INTL_LOCALE_BY_APP_LANGUAGE[language] ?? language.replace('_', '-');

  try {
    return new Intl.DateTimeFormat(locale, options).format(date);
  } catch {
    // An unrecognised language code makes Intl throw a RangeError.
    return new Intl.DateTimeFormat(FALLBACK_LOCALE, options).format(date);
  }
};
