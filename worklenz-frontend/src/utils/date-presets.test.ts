import { afterEach, describe, expect, it } from 'vitest';
import dayjs from 'dayjs';
import 'dayjs/locale/de';
import 'dayjs/locale/zh-cn';
import { formatCalendarDate, getDatePresetRange } from './date-presets';

const at = (isoDate: string) => dayjs(isoDate).hour(21).minute(30);

describe('getDatePresetRange', () => {
  it('this_month is month-to-date and includes today', () => {
    expect(getDatePresetRange('this_month', at('2026-09-17'))).toEqual({
      from: '2026-09-01',
      to: '2026-09-17',
    });
  });

  it('this_month on the last evening of the month covers the whole month', () => {
    expect(getDatePresetRange('this_month', at('2026-09-30'))).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    });
  });

  it('this_month on the 1st is just that day', () => {
    expect(getDatePresetRange('this_month', at('2026-10-01'))).toEqual({
      from: '2026-10-01',
      to: '2026-10-01',
    });
  });

  it('last_month keeps the 31st when the current month is shorter (regression: Aug 30)', () => {
    expect(getDatePresetRange('last_month', at('2026-09-30'))).toEqual({
      from: '2026-08-01',
      to: '2026-08-31',
    });
    expect(getDatePresetRange('last_month', at('2026-11-30'))).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
    });
  });

  it('last_month covers all of January when run in February', () => {
    expect(getDatePresetRange('last_month', at('2026-02-10'))).toEqual({
      from: '2026-01-01',
      to: '2026-01-31',
    });
  });

  it('last_month handles a leap February and a year boundary', () => {
    expect(getDatePresetRange('last_month', at('2028-03-31'))).toEqual({
      from: '2028-02-01',
      to: '2028-02-29',
    });
    expect(getDatePresetRange('last_month', at('2027-01-15'))).toEqual({
      from: '2026-12-01',
      to: '2026-12-31',
    });
  });

  it('keeps the rolling presets ending yesterday', () => {
    expect(getDatePresetRange('last_7_days', at('2026-09-30'))).toEqual({
      from: '2026-09-23',
      to: '2026-09-29',
    });
    expect(getDatePresetRange('last_30_days', at('2026-09-30'))).toEqual({
      from: '2026-08-31',
      to: '2026-09-29',
    });
  });

  it('today and yesterday are single days', () => {
    expect(getDatePresetRange('today', at('2026-09-30'))).toEqual({
      from: '2026-09-30',
      to: '2026-09-30',
    });
    expect(getDatePresetRange('yesterday', at('2026-10-01'))).toEqual({
      from: '2026-09-30',
      to: '2026-09-30',
    });
  });

  it('last_3_months includes today', () => {
    expect(getDatePresetRange('last_3_months', at('2026-09-30'))).toEqual({
      from: '2026-06-30',
      to: '2026-09-30',
    });
  });

  it('all_time has no bounds', () => {
    expect(getDatePresetRange('all_time', at('2026-09-30'))).toBeNull();
  });
});

describe('formatCalendarDate', () => {
  afterEach(() => {
    dayjs.locale('en');
  });

  it('writes a day the way the current language writes it', () => {
    expect(formatCalendarDate('2026-09-17')).toBe('Sep 17, 2026');

    dayjs.locale('de');
    expect(formatCalendarDate('2026-09-17')).toBe('17. Sept. 2026');

    dayjs.locale('zh-cn');
    expect(formatCalendarDate('2026-09-17')).toBe('2026年9月17日');
  });

  it('does not zero-pad the day of month', () => {
    expect(formatCalendarDate('2026-09-05')).toBe('Sep 5, 2026');
  });

  it('accepts a Dayjs value as well as an ISO string', () => {
    expect(formatCalendarDate(dayjs('2026-01-31'))).toBe('Jan 31, 2026');
  });
});

describe('this_week', () => {
  afterEach(() => {
    dayjs.locale('en');
  });

  // 2026-09-30 is a Wednesday; with the English locale a week runs Sunday to Saturday.
  it('is week-to-date: the first day of the week through today, today included', () => {
    expect(getDatePresetRange('this_week', at('2026-09-30'))).toEqual({
      from: '2026-09-27',
      to: '2026-09-30',
    });
  });

  it('is just today on the first day of the week', () => {
    expect(getDatePresetRange('this_week', at('2026-09-27'))).toEqual({
      from: '2026-09-27',
      to: '2026-09-27',
    });
  });

  it('is the whole week on its last day', () => {
    expect(getDatePresetRange('this_week', at('2026-10-03'))).toEqual({
      from: '2026-09-27',
      to: '2026-10-03',
    });
  });

  it('can start in the previous month or year', () => {
    expect(getDatePresetRange('this_week', at('2026-10-01'))).toEqual({
      from: '2026-09-27',
      to: '2026-10-01',
    });
    expect(getDatePresetRange('this_week', at('2027-01-01'))).toEqual({
      from: '2026-12-27',
      to: '2027-01-01',
    });
  });

  it("follows the language's first day of the week (Monday in German)", () => {
    dayjs.locale('de');
    expect(getDatePresetRange('this_week', at('2026-09-30'))).toEqual({
      from: '2026-09-28',
      to: '2026-09-30',
    });
    // a Sunday still belongs to the week that began on the Monday before it
    expect(getDatePresetRange('this_week', at('2026-09-27'))).toEqual({
      from: '2026-09-21',
      to: '2026-09-27',
    });
  });

  it.each(['en', 'de', 'zh-cn'])(
    'sits right after last_week, with no gap and no overlap (%s)',
    locale => {
      dayjs.locale(locale);
      for (const day of ['2026-09-27', '2026-09-30', '2026-10-03', '2027-01-01']) {
        const thisWeek = getDatePresetRange('this_week', at(day))!;
        const lastWeek = getDatePresetRange('last_week', at(day))!;
        expect(dayjs(lastWeek.to).add(1, 'day').format('YYYY-MM-DD')).toBe(thisWeek.from);
      }
    }
  );

  it('never extends past today', () => {
    for (const day of ['2026-09-27', '2026-09-29', '2026-10-03']) {
      expect(getDatePresetRange('this_week', at(day))!.to).toBe(day);
    }
  });
});
