import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { zhTW } from 'date-fns/locale';
import { formatDistanceToNow } from 'date-fns';
import { calculateTimeDifference } from '../calculate-time-difference';
import { calculateTimeGap } from '../calculate-time-gap';
import { currentDateString } from '../current-date-string';
import { formatDate } from '../dateUtils';
import { formatDateTimeWithLocale } from '../format-date-time-with-locale';
import { formatDateTimeWithUserTimezone } from '../format-date-time-with-user-timezone';
import { greetingString } from '../greetingString';

vi.mock('../language-utils', () => ({ getLanguageFromLocalStorage: () => 'zh_tw' }));
vi.mock('@/i18n', () => ({ default: { language: 'zh_tw' } }));

describe('Taiwan date formatting', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 18, 9, 30));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats both relative-time paths in Traditional Chinese', () => {
    const yesterday = new Date(2026, 4, 17, 9, 30);
    const expected = formatDistanceToNow(yesterday, { addSuffix: true, locale: zhTW });

    expect(calculateTimeGap(yesterday)).toBe(expected);
    expect(calculateTimeDifference(yesterday)).toBe(expected);
    expect(calculateTimeDifference(new Date())).toBe('剛剛');
    expect(calculateTimeDifference(new Date(), 'Now')).toBe('Now');
  });

  it('registers the Day.js locale for the greeting and date utilities', () => {
    expect(currentDateString()).toContain('星期一');
    expect(currentDateString()).toContain('五月');
    expect(formatDate(new Date(), 'dddd')).toBe('星期一');
    expect(greetingString('Alex')).toBe('Alex，早安！');
  });

  it('uses Taiwan month names without a timezone override', () => {
    const timestamp = new Date(2026, 4, 18, 9, 30).toISOString();

    expect(formatDateTimeWithLocale(timestamp)).toContain('5月');
    expect(formatDateTimeWithUserTimezone(timestamp)).toBe(formatDateTimeWithLocale(timestamp));
  });

  it('uses Taiwan formatting with an explicit timezone', () => {
    const timestamp = '2026-05-18T01:30:00.000Z';
    const expected = new Date(timestamp).toLocaleString('zh-TW', {
      timeZone: 'Asia/Taipei', year: 'numeric', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
    });

    expect(formatDateTimeWithUserTimezone(timestamp, 'Asia/Taipei')).toBe(expected);
  });
});
