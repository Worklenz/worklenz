import { format } from 'date-fns';
import { enUS, es, pt } from 'date-fns/locale';
import { getLanguageFromLocalStorage } from './language-utils';

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
        hour12: true
      };
      
      // Get the appropriate locale
      const localeString = getLanguageFromLocalStorage();
      const localeMap = {
        'en': 'en-US',
        'es': 'es-ES',
        'pt': 'pt-PT'
      };
      const locale = localeMap[localeString as keyof typeof localeMap] || 'en-US';
      
      return date.toLocaleString(locale, options);
    }
    
    // Fallback to date-fns formatting for UTC or when no timezone
    const localeString = getLanguageFromLocalStorage();
    const locale = localeString === 'en' ? enUS : localeString === 'es' ? es : pt;
    return format(date, 'MMM d, yyyy, h:mm:ss a', { locale });
  } catch (error) {
    console.error('Error formatting date with user timezone:', error);
    // Fallback to original date string if formatting fails
    return dateString;
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
export const isYesterdayInUserTimezone = (dateString: string, userTimezone?: string | null): boolean => {
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