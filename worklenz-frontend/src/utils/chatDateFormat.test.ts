import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import { formatDateForSeparator, isDifferentDay } from './chatDateFormat';

describe('chatDateFormat', () => {
  const mockT = (key: string, opts?: Record<string, unknown>) => {
    const translations: Record<string, string> = {
      today: 'Today',
      yesterday: 'Yesterday',
    };
    return (opts?.defaultValue as string) || translations[key] || key;
  };

  it('returns Today when date is today', () => {
    const now = dayjs().toISOString();
    expect(formatDateForSeparator(now, mockT)).toBe('Today');
  });

  it('returns Yesterday when date is yesterday', () => {
    const yesterday = dayjs().subtract(1, 'day').toISOString();
    expect(formatDateForSeparator(yesterday, mockT)).toBe('Yesterday');
  });

  it('formats older date in English by default', () => {
    const result = formatDateForSeparator('2026-09-02T12:00:00.000Z', mockT, 'en');
    expect(result).toBe('September 2, 2026');
  });

  it('formats older date in Chinese when language is zh_cn', () => {
    const result = formatDateForSeparator('2026-09-02T12:00:00.000Z', mockT, 'zh_cn');
    expect(result).toBe('2026年9月2日');
  });

  it('formats older date in Chinese when language is zh', () => {
    const result = formatDateForSeparator('2026-09-02T12:00:00.000Z', mockT, 'zh');
    expect(result).toBe('2026年9月2日');
  });

  it('formats older date in Spanish when language is es', () => {
    const result = formatDateForSeparator('2026-09-02T12:00:00.000Z', mockT, 'es');
    expect(result).toBe('2 de septiembre de 2026');
  });

  it('formats older date in German when language is de', () => {
    const result = formatDateForSeparator('2026-09-02T12:00:00.000Z', mockT, 'de');
    expect(result).toBe('2. September 2026');
  });

  it('formats older date in Albanian when language is alb', () => {
    const result = formatDateForSeparator('2026-09-02T12:00:00.000Z', mockT, 'alb');
    expect(result).toBe('2 Shtator 2026');
  });

  it('correctly detects different days', () => {
    expect(isDifferentDay('2026-09-02T10:00:00Z', '2026-09-03T10:00:00Z')).toBe(true);
    expect(isDifferentDay('2026-09-02T10:00:00Z', '2026-09-02T18:00:00Z')).toBe(false);
  });
});
