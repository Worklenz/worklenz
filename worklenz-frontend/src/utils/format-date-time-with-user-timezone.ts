import { format } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import { es } from 'date-fns/locale/es';
import { pt } from 'date-fns/locale/pt';
import { de } from 'date-fns/locale/de';
import { zhCN } from 'date-fns/locale/zh-CN';
import { sq } from 'date-fns/locale/sq';
import i18n from '@/i18n';

/**
 * Formats a date/time string using the user's profile timezone
 * This ensures consistency between time logs display and reporting filters
 *
 * @param dateString - The date string to format (typically in UTC)
 * @param userTimezone - The user's timezone from their profile (e.g., 'America/New_York')
 * @returns Formatted date string in user's timezone
 */
export const formatDateTimeWithUserTimezone = (
  dateString: string,
  userTimezone?: string | null
): string => {
  if (!dateString) return '';

  try {
    const date = new Date(dateString);

    // If timezone is provided, use it for formatting
    if (userTimezone && userTimezone !== 'UTC') {
      // Use the browser's toLocaleString with timezone option
      const options: Intl.DateTimeFormatOptions = {
        timeZone: userTimezone,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      };

      const lng = (i18n.language || 'en').split('-')[0];
      const localeMap: Record<string, string> = {
        en: 'en-US',
        es: 'es-ES',
        pt: 'pt-PT',
        de: 'de-DE',
        fr: 'fr-FR',
        pl: 'pl-PL',
        zh: 'zh-CN',
        alb: 'sq-AL',
      };
      const locale = localeMap[lng] || 'en-US';

      return date.toLocaleString(locale, options);
    }

    // Fallback to date-fns formatting for UTC or when no timezone
    const lng = (i18n.language || 'en').split('-')[0];
    const locale =
      lng === 'en'
        ? enUS
        : lng === 'es'
          ? es
          : lng === 'pt'
            ? pt
            : lng === 'de'
              ? de
              : lng === 'zh'
                ? zhCN
                : lng === 'alb'
                  ? sq
                  : enUS;
    return format(date, 'MMM d, yyyy, h:mm:ss a', { locale });
  } catch (error) {
    console.error('Error formatting date with user timezone:', error);
    // Fallback to original date string if formatting fails
    return dateString;
  }
};

/**
 * Formats a time log start and end into a clean timeline range in the user's timezone (Option A - no seconds)
 * Examples:
 * - Overnight: "Oct 14, 2026, 11:00 PM – Oct 15, 2026, 2:00 AM"
 * - Same-day: "Oct 14, 2026, 10:00 AM – 12:00 PM"
 * - Single/fallback: "Oct 14, 2026, 11:00 PM"
 */
export const formatLogTimeline = (
  startDateString?: string | null,
  endDateString?: string | null,
  userTimezone?: string | null
): string => {
  if (!startDateString) return '';

  try {
    const start = new Date(startDateString);
    if (isNaN(start.getTime())) return startDateString;

    const lng = (i18n.language || 'en').split('-')[0];
    const localeMap: Record<string, string> = {
      en: 'en-US',
      es: 'es-ES',
      pt: 'pt-PT',
      de: 'de-DE',
      fr: 'fr-FR',
      pl: 'pl-PL',
      zh: 'zh-CN',
      alb: 'sq-AL',
    };
    const locale = localeMap[lng] || 'en-US';
    const tz = userTimezone && userTimezone !== 'UTC' ? userTimezone : (userTimezone === 'UTC' ? 'UTC' : undefined);

    const dateOpts: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...(tz ? { timeZone: tz } : {}),
    };

    const timeOpts: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      ...(tz ? { timeZone: tz } : {}),
    };

    const formattedStartDate = start.toLocaleDateString(locale, dateOpts);
    const formattedStartTime = start.toLocaleTimeString(locale, timeOpts);

    if (!endDateString) {
      return `${formattedStartDate}, ${formattedStartTime}`;
    }

    const end = new Date(endDateString);
    if (isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
      return `${formattedStartDate}, ${formattedStartTime}`;
    }

    const formattedEndDate = end.toLocaleDateString(locale, dateOpts);
    const formattedEndTime = end.toLocaleTimeString(locale, timeOpts);

    const isSameDay =
      start.toLocaleDateString(locale, { year: 'numeric', month: 'numeric', day: 'numeric', ...(tz ? { timeZone: tz } : {}) }) ===
      end.toLocaleDateString(locale, { year: 'numeric', month: 'numeric', day: 'numeric', ...(tz ? { timeZone: tz } : {}) });

    if (isSameDay) {
      return `${formattedStartDate}, ${formattedStartTime} – ${formattedEndTime}`;
    }

    return `${formattedStartDate}, ${formattedStartTime} – ${formattedEndDate}, ${formattedEndTime}`;
  } catch (error) {
    console.error('Error formatting timeline with user timezone:', error);
    return startDateString;
  }
};

/**
 * Checks if a date is "yesterday" in the user's timezone
 * This is used to ensure consistency with reporting filters
 *
 * @param dateString - The date string to check
 * @param userTimezone - The user's timezone from their profile
 * @returns true if the date is yesterday in user's timezone
 */
export const isYesterdayInUserTimezone = (
  dateString: string,
  userTimezone?: string | null
): boolean => {
  if (!dateString || !userTimezone) return false;

  try {
    const date = new Date(dateString);

    // Get current date in user's timezone
    const nowInTimezone = new Date().toLocaleString('en-US', { timeZone: userTimezone });
    const now = new Date(nowInTimezone);

    // Get yesterday in user's timezone
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    // Convert the input date to user's timezone
    const dateInTimezone = new Date(date.toLocaleString('en-US', { timeZone: userTimezone }));

    // Compare dates (ignoring time)
    return (
      dateInTimezone.getFullYear() === yesterday.getFullYear() &&
      dateInTimezone.getMonth() === yesterday.getMonth() &&
      dateInTimezone.getDate() === yesterday.getDate()
    );
  } catch (error) {
    console.error('Error checking if date is yesterday:', error);
    return false;
  }
};
