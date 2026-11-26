import { decodeHtmlEntities } from '@/utils/html-entities';

/**
 * Decode HTML entities stored by backend sanitizePlainText() for display
 * in analytics charts, tables, and filter labels.
 */
export const analyticsDisplayText = (text: string | null | undefined): string =>
  decodeHtmlEntities(text ?? '');

/** Truncate a display label after decoding so entity sequences are not cut mid-way. */
export const shortAnalyticsLabel = (name: string, max = 14): string => {
  const decoded = analyticsDisplayText(name);
  if (decoded.length <= max) return decoded;
  return `${decoded.slice(0, max - 1)}…`;
};
