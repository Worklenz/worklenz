import { describe, it, expect } from 'vitest';
import { formatDate } from '../dateUtils';

describe('formatDate with zh-TW locale', () => {
  it('formats the weekday in Chinese for zh-TW', () => {
    // 2024-01-15 是星期一;dayjs zh-tw 的 dddd 應輸出「星期一」。
    expect(formatDate('2024-01-15', 'dddd', 'zh-TW')).toBe('星期一');
  });

  it('does not fall back to the English weekday for zh-TW', () => {
    expect(formatDate('2024-01-15', 'dddd', 'zh-TW')).not.toBe('Monday');
  });
});
