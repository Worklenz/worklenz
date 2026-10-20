import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../i18n', () => ({ default: { changeLanguage: vi.fn() } }));

describe('Taiwan language preferences', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(['zh-TW', 'zh-Hant-TW', 'zh-Hant', 'zh_tw', 'zh_hant_tw'])(
    'uses zh_tw for the %s browser locale',
    async browserLanguage => {
      vi.spyOn(navigator, 'language', 'get').mockReturnValue(browserLanguage);
      const { default: reducer, Language } = await import('./localesSlice');
      const { getDefaultLanguage } = await import('@/utils/language-utils');

      expect(reducer(undefined, { type: 'init' }).lng).toBe(Language.ZH_TW);
      expect(getDefaultLanguage()).toBe(Language.ZH_TW);
    }
  );

  it('keeps a saved preference ahead of the browser default', async () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('zh-TW');
    localStorage.setItem('i18nextLng', 'de');
    const { default: reducer } = await import('./localesSlice');
    const { getLanguageFromLocalStorage } = await import('@/utils/language-utils');

    expect(reducer(undefined, { type: 'init' }).lng).toBe('de');
    expect(getLanguageFromLocalStorage()).toBe('de');
  });

  it('restores the server-saved zh_tw preference', async () => {
    const { applyLanguageFromUser } = await import('./localesSlice');
    const { default: i18n } = await import('../../i18n');

    applyLanguageFromUser('zh_tw');

    expect(localStorage.getItem('i18nextLng')).toBe('zh_tw');
    expect(i18n.changeLanguage).toHaveBeenCalledWith('zh_tw');
  });

  it.each([['en-US', 'en'], ['es-ES', 'es'], ['zh-CN', 'en'], ['xx-YY', 'en']])(
    'preserves the existing %s browser fallback',
    async (browserLanguage, expected) => {
      vi.spyOn(navigator, 'language', 'get').mockReturnValue(browserLanguage);
      const { default: reducer } = await import('./localesSlice');
      const { getDefaultLanguage } = await import('@/utils/language-utils');

      expect(reducer(undefined, { type: 'init' }).lng).toBe(expected);
      expect(getDefaultLanguage()).toBe(expected);
    }
  );
});
