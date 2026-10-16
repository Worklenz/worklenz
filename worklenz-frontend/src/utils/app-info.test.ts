import { afterEach, describe, expect, it, vi } from 'vitest';

import { formatBuildDate, getBuildDate } from './app-info';

// Local noon, so the formatted day is stable in any timezone.
const SAMPLE_DATE = new Date(2026, 8, 3, 12, 0, 0);

describe('app-info', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getBuildDate', () => {
    it('should return null when the build constant is not injected (e.g. under vitest)', () => {
      expect(getBuildDate()).toBeNull();
    });

    it('should parse the millisecond timestamp Vite injects', () => {
      vi.stubGlobal('__BUILD_TIMESTAMP__', String(SAMPLE_DATE.getTime()));

      expect(getBuildDate()?.getTime()).toBe(SAMPLE_DATE.getTime());
    });

    it('should return null for an unparseable timestamp', () => {
      vi.stubGlobal('__BUILD_TIMESTAMP__', 'not-a-number');

      expect(getBuildDate()).toBeNull();
    });
  });

  describe('formatBuildDate', () => {
    it('should format as a long date in English', () => {
      expect(formatBuildDate(SAMPLE_DATE, 'en')).toBe('September 3, 2026');
    });

    it('should localize to the app language', () => {
      expect(formatBuildDate(SAMPLE_DATE, 'de')).toBe('3. September 2026');
      expect(formatBuildDate(SAMPLE_DATE, 'es')).toContain('septiembre');
    });

    it("should map the app's non-BCP-47 codes ('alb', 'zh_cn') instead of falling back to English", () => {
      const albanian = formatBuildDate(SAMPLE_DATE, 'alb');
      const chinese = formatBuildDate(SAMPLE_DATE, 'zh_cn');

      expect(albanian).toContain('2026');
      expect(albanian).not.toBe('September 3, 2026');
      expect(chinese).toContain('2026年');
      expect(formatBuildDate(SAMPLE_DATE, 'zh')).toBe(chinese);
    });

    it('should fall back to English instead of throwing on an invalid language code', () => {
      expect(formatBuildDate(SAMPLE_DATE, 'not a locale!')).toBe('September 3, 2026');
    });
  });
});
