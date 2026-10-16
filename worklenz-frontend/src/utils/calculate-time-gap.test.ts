import { describe, it, expect } from 'vitest';
import { calculateTimeGap } from './calculate-time-gap';
import { formatDateTimeWithLocale } from './format-date-time-with-locale';

describe('calculateTimeGap', () => {
  it('returns empty string for falsy timestamp', () => {
    expect(calculateTimeGap('')).toBe('');
    expect(calculateTimeGap(null as any)).toBe('');
  });

  it('formats relative time in English', () => {
    const date = new Date(Date.now() - 7 * 60 * 1000);
    expect(calculateTimeGap(date, 'en')).toBe('7 minutes ago');
  });

  it('formats relative time in Chinese when language is zh_cn', () => {
    const date = new Date(Date.now() - 7 * 60 * 1000);
    expect(calculateTimeGap(date, 'zh_cn')).toBe('7 分钟前');
  });

  it('formats relative time in Chinese when language is zh', () => {
    const date = new Date(Date.now() - 7 * 60 * 1000);
    expect(calculateTimeGap(date, 'zh')).toBe('7 分钟前');
  });

  it('formats relative time in Albanian when language is alb', () => {
    const date = new Date(Date.now() - 7 * 60 * 1000);
    expect(calculateTimeGap(date, 'alb')).toBe('7 minuta më parë');
  });

  it('formats relative time in Spanish when language is es', () => {
    const date = new Date(Date.now() - 7 * 60 * 1000);
    expect(calculateTimeGap(date, 'es')).toBe('hace 7 minutos');
  });
});

describe('formatDateTimeWithLocale', () => {
  const FIXED_DATE = '2026-09-30T10:00:00.000Z';

  it('returns empty string for falsy date', () => {
    expect(formatDateTimeWithLocale('')).toBe('');
  });

  it('formats date time with English locale by default', () => {
    const formatted = formatDateTimeWithLocale(FIXED_DATE, 'en');
    expect(formatted).toContain('Sep');
    expect(formatted).toContain('2026');
  });

  it('formats date time with Chinese locale when language is zh_cn', () => {
    const formatted = formatDateTimeWithLocale(FIXED_DATE, 'zh_cn');
    expect(formatted).toContain('9月');
    expect(formatted).toContain('2026');
  });
});
