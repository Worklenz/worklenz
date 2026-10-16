/** Date helpers shared by the v2 pages. Every one tolerates null, so "Not set" is the caller's wording. */

const toDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** "Jun 6, 2026" in the active language, or null when there is no (valid) date. */
export const formatPortalDate = (value: string | null | undefined, locale?: string): string | null => {
  const date = toDate(value);
  return date
    ? new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(date)
    : null;
};

/** "Jun 6, 2026, 2:30 PM" in the active language, or null. */
export const formatPortalDateTime = (
  value: string | null | undefined,
  locale?: string
): string | null => {
  const date = toDate(value);
  return date
    ? new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(date)
    : null;
};

const RELATIVE_UNITS: { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
  { unit: 'year', ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: 'day', ms: 24 * 60 * 60 * 1000 },
  { unit: 'hour', ms: 60 * 60 * 1000 },
  { unit: 'minute', ms: 60 * 1000 },
];

/** "3 days ago" / "just now" in the active language, or null when there is no (valid) date. */
export const formatRelativeTime = (
  value: string | null | undefined,
  locale?: string,
  now: number = Date.now()
): string | null => {
  const date = toDate(value);
  if (!date) return null;

  const diff = date.getTime() - now;
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  for (const { unit, ms } of RELATIVE_UNITS) {
    if (Math.abs(diff) >= ms) return formatter.format(Math.round(diff / ms), unit);
  }
  return formatter.format(0, 'second');
};

/** True when `value` is an ISO date before today (a date-only value is not "overdue" until the day ends). */
export const isBeforeToday = (value: string | null | undefined, now: Date = new Date()): boolean => {
  const date = toDate(value);
  if (!date) return false;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return date.getTime() < startOfToday;
};

/** Two-letter initials for an avatar from a person's or organization's name. */
export const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

/** "3:45 PM" in the active language, or null when there is no (valid) date. */
export const formatPortalTime = (value: string | null | undefined, locale?: string): string | null => {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(date) : null;
};
