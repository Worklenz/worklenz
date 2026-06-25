import { describe, it, expect } from 'vitest';
import { Language } from '../localesSlice';

describe('Language enum', () => {
  it('includes zh-TW whose value exactly matches the locale folder name', () => {
    // i18next loadPath 直接以語言代碼當資料夾名(大小寫敏感)。
    // public/locales/zh-TW 必須與此值逐字元一致。
    expect(Object.values(Language)).toContain('zh-TW');
    expect(Language.ZH_TW).toBe('zh-TW');
  });
});
