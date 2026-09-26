import { describe, it, expect } from 'vitest';
import { toQueryString } from '../toQueryString';
import { toArray } from '../to-array';
import { validateEmail } from '../validateEmail';

describe('query-array-utils', () => {
  describe('toQueryString', () => {
    it('serializes simple key-value pairs', () => {
      const result = toQueryString({ page: 1, limit: 10, search: 'work' });
      expect(result).toBe('?page=1&limit=10&search=work');
    });

    it('ignores null and undefined values', () => {
      const result = toQueryString({ a: 'yes', b: null, c: undefined, d: 'ok' });
      expect(result).toBe('?a=yes&d=ok');
    });

    it('joins array values with commas by default', () => {
      const result = toQueryString({ tags: ['urgent', 'bug'], project: 'p1' });
      expect(result).toBe('?tags=urgent%2Cbug&project=p1');
    });

    it('uses brackets format when opts.arrayFormat is brackets', () => {
      const result = toQueryString(
        { ids: ['1', '2'] },
        { arrayFormat: 'brackets' }
      );
      expect(result).toBe('?ids[]=1&ids[]=2');
    });

    it('returns ? for empty object', () => {
      expect(toQueryString({})).toBe('?');
    });
  });

  describe('toArray', () => {
    it('returns array as-is when input is an array', () => {
      expect(toArray([1, 2, 3])).toEqual([1, 2, 3]);
      expect(toArray(['a', 'b'])).toEqual(['a', 'b']);
    });

    it('returns empty array when input is null or undefined', () => {
      expect(toArray(null)).toEqual([]);
      expect(toArray(undefined)).toEqual([]);
    });

    it('returns empty array when input is a scalar or object', () => {
      expect(toArray('string' as any)).toEqual([]);
      expect(toArray({} as any)).toEqual([]);
    });
  });

  describe('validateEmail', () => {
    it('returns true for valid email formats', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name@sub.domain.org')).toBe(true);
    });

    it('returns false for invalid email formats', () => {
      expect(validateEmail('')).toBe(false);
      expect(validateEmail('notanemail')).toBe(false);
      expect(validateEmail('missingdomain@')).toBe(false);
      expect(validateEmail('two@@domains.com')).toBe(false);
    });
  });
});
