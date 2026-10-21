import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import dayjs from 'dayjs';
import { fromNow, formatDate } from './dateUtils';

describe('dateUtils', () => {
  const FIXED_DATE = '2026-09-30T10:00:00.000Z';

  describe('fromNow', () => {
    it('returns empty string for falsy date', () => {
      expect(fromNow('')).toBe('');
      expect(fromNow(null as any)).toBe('');
      expect(fromNow(undefined as any)).toBe('');
    });

    it('formats relative time in English by default', () => {
      const recent = dayjs().subtract(10, 'second').toISOString();
      const result = fromNow(recent, 'en');
      expect(result).toMatch(/few seconds ago|seconds ago/);
    });

    it('formats relative time in Chinese when language is zh_cn', () => {
      const recent = dayjs().subtract(10, 'second').toISOString();
      const result = fromNow(recent, 'zh_cn');
      expect(result).toBe('几秒前');
    });

    it('formats relative time in Chinese when language is zh', () => {
      const recent = dayjs().subtract(10, 'second').toISOString();
      const result = fromNow(recent, 'zh');
      expect(result).toBe('几秒前');
    });

    it('formats relative time in Chinese when language is zh-cn', () => {
      const recent = dayjs().subtract(10, 'second').toISOString();
      const result = fromNow(recent, 'zh-cn');
      expect(result).toBe('几秒前');
    });

    it('formats relative time in Albanian when language is alb', () => {
      const recent = dayjs().subtract(10, 'second').toISOString();
      const result = fromNow(recent, 'alb');
      expect(result).toContain('sekonda');
    });

    it('formats relative time in Spanish when language is es', () => {
      const recent = dayjs().subtract(10, 'second').toISOString();
      const result = fromNow(recent, 'es');
      expect(result).toContain('segundos');
    });
  });

  describe('formatDate', () => {
    it('returns empty string for falsy date', () => {
      expect(formatDate('')).toBe('');
      expect(formatDate(null as any)).toBe('');
    });

    it('formats date using custom format and locale', () => {
      const formatted = formatDate(FIXED_DATE, 'YYYY-MM-DD');
      expect(formatted).toBe('2026-09-30');
    });

    it('formats date with LLL in Chinese when language is zh_cn', () => {
      const formatted = formatDate(FIXED_DATE, 'LLL', 'zh_cn');
      expect(formatted).toContain('2026年');
      expect(formatted).toContain('9月');
    });

    it('formats date with LLL in English when language is en', () => {
      const formatted = formatDate(FIXED_DATE, 'LLL', 'en');
      expect(formatted).toContain('September');
      expect(formatted).toContain('2026');
    });
  });
});
