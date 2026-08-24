import { describe, it, expect, vi, beforeEach } from 'vitest';
import { greetingString } from '../greetingString';

describe('greetingString for zh-TW', () => {
  beforeEach(() => {
    // setup.ts 已將 localStorage 設為 mock;此處注入繁中。
    vi.mocked(localStorage.getItem).mockReturnValue('zh-TW');
  });

  it('returns a Chinese greeting without the English fallback', () => {
    const result = greetingString('小明');
    expect(result).toContain('你好');
    expect(result).toContain('小明');
    expect(result).not.toContain('Good'); // 非英文 "Hi xxx, Good morning!"
  });

  it('uses the 早安/午安/晚安 wording (not simplified 早上好 etc.)', () => {
    // 不鎖定時段,三者之一即可。
    const result = greetingString('小明');
    expect(result).toMatch(/早安|午安|晚安/);
  });
});
