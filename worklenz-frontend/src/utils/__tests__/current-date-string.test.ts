import { describe, it, expect, vi, beforeEach } from 'vitest';
import { currentDateString } from '../current-date-string';

describe('currentDateString for zh-TW', () => {
  beforeEach(() => {
    // setup.ts 已將 localStorage 設為 mock;此處注入繁中。
    vi.mocked(localStorage.getItem).mockReturnValue('zh-TW');
  });

  it('uses the Chinese 今天是 prefix and a Chinese weekday for zh-TW', () => {
    const result = currentDateString();
    expect(result).toContain('今天是');
    expect(result).toContain('星期');
  });

  it('does not fall back to English weekday/month names for zh-TW', () => {
    const result = currentDateString();
    expect(result).not.toMatch(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/);
    expect(result).not.toMatch(/January|February|March|April|May|June|July|August|September|October|November|December/);
  });
});
