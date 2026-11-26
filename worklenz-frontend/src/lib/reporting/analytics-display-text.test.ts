import { describe, expect, it } from 'vitest';
import { analyticsDisplayText, shortAnalyticsLabel } from './analytics-display-text';

describe('analyticsDisplayText', () => {
  it('decodes HTML entities from sanitized project names', () => {
    expect(analyticsDisplayText('&lt;&gt; myproject')).toBe('<> myproject');
    expect(analyticsDisplayText('Deasign &amp; Creation')).toBe('Deasign & Creation');
    expect(analyticsDisplayText('ABCD @#$%^&amp;*&lt;&gt;')).toBe('ABCD @#$%^&*<>');
  });

  it('returns empty string for nullish input', () => {
    expect(analyticsDisplayText(undefined)).toBe('');
    expect(analyticsDisplayText(null)).toBe('');
  });
});

describe('shortAnalyticsLabel', () => {
  it('truncates after decoding so entities are not cut mid-sequence', () => {
    expect(shortAnalyticsLabel('ABCD @#$%^&amp;*&lt;&gt;', 14)).toBe('ABCD @#$%^&*<>');
    expect(shortAnalyticsLabel('Deasign &amp; Creation', 10)).toBe('Deasign &…');
  });
});
