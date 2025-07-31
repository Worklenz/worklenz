import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

// Initialize the relativeTime plugin
dayjs.extend(relativeTime);

/**
 * Formats a date to a relative time string (e.g., "2 hours ago", "a day ago")
 * This mimics the Angular fromNow pipe functionality
 *
 * @param date - The date to format (string, Date, or dayjs object)
 * @returns A string representing the relative time
 */
export const fromNow = (date: string | Date | dayjs.Dayjs): string => {
  if (!date) return '';
  return dayjs(date).fromNow();
};

/**
 * Formats a date to a specific format
 *
 * @param date - The date to format (string, Date, or dayjs object)
 * @param format - The format string (default: 'YYYY-MM-DD')
 * @returns A formatted date string
 */
export const formatDate = (
  date: string | Date | dayjs.Dayjs,
  format: string = 'YYYY-MM-DD'
): string => {
  if (!date) return '';
  return dayjs(date).format(format);
};
