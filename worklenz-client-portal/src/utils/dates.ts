import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

/** The IANA zone to show dates in; null/undefined means the browser's. */
const zoned = (value: string, tz?: string | null) => {
  // A bare date (YYYY-MM-DD) is a calendar day, not an instant: never shift it across zones.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return dayjs(value);
  const parsed = dayjs(value);
  if (!tz) return parsed;
  try {
    return parsed.tz(tz);
  } catch {
    return parsed;
  }
};

/** "Jun 5, 2026", or `fallback` for an empty value (the portal never invents a date). */
export const formatDate = (value: string | null | undefined, fallback: string, tz?: string | null): string =>
  value ? zoned(value, tz).format('MMM D, YYYY') : fallback;

/** "Jun 5, 9:12 AM". */
export const formatDateTime = (value: string | null | undefined, tz?: string | null): string =>
  value ? zoned(value, tz).format('MMM D, h:mm A') : '';

/** Whole days from today (negative = past). Compares calendar days. */
export const daysFromToday = (value: string): number =>
  dayjs(value).startOf('day').diff(dayjs().startOf('day'), 'day');

/** Resolve a Worklenz timezone id/name to an IANA zone, or null if it is not one. */
export const toIanaZone = (name: string | null | undefined): string | null => {
  if (!name) return null;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: name });
    return name;
  } catch {
    return null;
  }
};

/** "5 minutes ago". Falls back to the formatted date for anything older than a week. */
export const formatRelative = (value: string | null | undefined, tz?: string | null): string => {
  if (!value) return '';
  const parsed = dayjs(value);
  if (dayjs().diff(parsed, 'day') >= 7) return formatDateTime(value, tz);
  return parsed.fromNow();
};
