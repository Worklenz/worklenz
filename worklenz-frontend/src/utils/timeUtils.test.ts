import { describe, expect, it } from 'vitest';
import dayjs from 'dayjs';
import { computeTimeRangeSplits, groupContiguousOvernightLogs } from './timeUtils';

describe('computeTimeRangeSplits', () => {
  it('handles daytime same-day range correctly', () => {
    const date = dayjs('2026-10-15');
    const start = dayjs('2026-10-15 09:00:00');
    const end = dayjs('2026-10-15 17:00:00');

    const result = computeTimeRangeSplits(date, start, end);
    expect(result.isOvernight).toBe(false);
    expect(result.totalSeconds).toBe(28800); // 8 hours
    expect(result.totalHours).toBe(8);
    expect(result.remainingMinutes).toBe(0);
    expect(result.splits).toHaveLength(1);
    expect(result.splits[0].seconds_spent).toBe(28800);
    expect(dayjs(result.splits[0].formatted_start).hour()).toBe(9);
  });

  it('splits overnight range crossing midnight into two entries (e.g. 22:00 to 02:00)', () => {
    const date = dayjs('2026-10-15');
    const start = dayjs('2026-10-15 22:00:00');
    const end = dayjs('2026-10-15 02:00:00');

    const result = computeTimeRangeSplits(date, start, end);
    expect(result.isOvernight).toBe(true);
    expect(result.totalSeconds).toBe(14400); // 4 hours
    expect(result.totalHours).toBe(4);
    expect(result.remainingMinutes).toBe(0);
    expect(result.splits).toHaveLength(2);

    // Day 1 entry: 22:00 to 24:00 (2 hours)
    expect(result.splits[0].seconds_spent).toBe(7200);
    expect(result.splits[0].hours).toBe(2);
    expect(result.splits[0].minutes).toBe(0);
    expect(dayjs(result.splits[0].formatted_start).format('YYYY-MM-DD HH:mm')).toBe('2026-10-15 22:00');

    // Day 2 entry: 00:00 to 02:00 (2 hours)
    expect(result.splits[1].seconds_spent).toBe(7200);
    expect(result.splits[1].hours).toBe(2);
    expect(result.splits[1].minutes).toBe(0);
    expect(dayjs(result.splits[1].formatted_start).format('YYYY-MM-DD HH:mm')).toBe('2026-10-16 00:00');
  });

  it('handles overnight range ending exactly at midnight (e.g. 22:00 to 00:00)', () => {
    const date = dayjs('2026-10-15');
    const start = dayjs('2026-10-15 22:00:00');
    const end = dayjs('2026-10-15 00:00:00');

    const result = computeTimeRangeSplits(date, start, end);
    expect(result.isOvernight).toBe(false);
    expect(result.totalSeconds).toBe(7200);
    expect(result.totalHours).toBe(2);
    expect(result.remainingMinutes).toBe(0);
    expect(result.splits).toHaveLength(1);
    expect(result.splits[0].seconds_spent).toBe(7200);
    expect(dayjs(result.splits[0].formatted_start).format('YYYY-MM-DD HH:mm')).toBe('2026-10-15 22:00');
  });

  it('handles uneven overnight splits (e.g. 23:15 to 01:45)', () => {
    const date = dayjs('2026-10-15');
    const start = dayjs('2026-10-15 23:15:00');
    const end = dayjs('2026-10-15 01:45:00');

    const result = computeTimeRangeSplits(date, start, end);
    expect(result.isOvernight).toBe(true);
    expect(result.totalSeconds).toBe(9000); // 2h 30m
    expect(result.totalHours).toBe(2);
    expect(result.remainingMinutes).toBe(30);
    expect(result.splits).toHaveLength(2);

    // Day 1: 45 minutes
    expect(result.splits[0].seconds_spent).toBe(2700);
    expect(result.splits[0].hours).toBe(0);
    expect(result.splits[0].minutes).toBe(45);

    // Day 2: 1h 45m
    expect(result.splits[1].seconds_spent).toBe(6300);
    expect(result.splits[1].hours).toBe(1);
    expect(result.splits[1].minutes).toBe(45);
  });
});

describe('groupContiguousOvernightLogs', () => {
  it('returns empty array when given empty list', () => {
    expect(groupContiguousOvernightLogs([])).toEqual([]);
  });

  it('keeps single normal log untouched', () => {
    const logs = [
      {
        id: 'log-1',
        user_id: 'user-1',
        time_spent: 3600,
        start_time: '2026-10-15T10:00:00.000Z',
        end_time: '2026-10-15T11:00:00.000Z',
        created_at: '2026-10-15T10:00:00.000Z',
        description: 'Normal work',
      },
    ];

    const grouped = groupContiguousOvernightLogs(logs);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].id).toBe('log-1');
    expect(grouped[0].is_overnight_split).toBeFalsy();
  });

  it('groups contiguous midnight split logs into a single 4-hour entry', () => {
    // logs in descending order as returned by getByTask:
    const day2Log = {
      id: 'log-day2',
      user_id: 'user-1',
      time_spent: 7200,
      start_time: '2026-10-16T00:00:00',
      end_time: '2026-10-16T02:00:00',
      created_at: '2026-10-16T00:00:00',
      description: 'Night deploy',
      user_name: 'Alice',
    };
    const day1Log = {
      id: 'log-day1',
      user_id: 'user-1',
      time_spent: 7200,
      start_time: '2026-10-15T22:00:00',
      end_time: '2026-10-16T00:00:00',
      created_at: '2026-10-15T22:00:00',
      description: 'Night deploy',
      user_name: 'Alice',
    };

    const grouped = groupContiguousOvernightLogs([day2Log, day1Log]);
    expect(grouped).toHaveLength(1);

    const merged = grouped[0];
    expect(merged.is_overnight_split).toBe(true);
    expect(merged.id).toBe('log-day1');
    expect(merged.part_log_ids).toEqual(['log-day1', 'log-day2']);
    expect(merged.time_spent).toBe(14400); // 4 hours
    expect(merged.time_spent_text).toBe('4h');
    expect(merged.daily_breakdown).toHaveLength(2);
    expect(merged.daily_breakdown?.[0].time_spent).toBe(7200);
    expect(merged.daily_breakdown?.[1].time_spent).toBe(7200);
  });

  it('does not group logs from different users', () => {
    const day2Log = {
      id: 'log-day2',
      user_id: 'user-bob',
      time_spent: 7200,
      start_time: '2026-10-16T00:00:00',
      end_time: '2026-10-16T02:00:00',
      created_at: '2026-10-16T00:00:00',
    };
    const day1Log = {
      id: 'log-day1',
      user_id: 'user-alice',
      time_spent: 7200,
      start_time: '2026-10-15T22:00:00',
      end_time: '2026-10-16T00:00:00',
      created_at: '2026-10-15T22:00:00',
    };

    const grouped = groupContiguousOvernightLogs([day2Log, day1Log]);
    expect(grouped).toHaveLength(2);
  });
});
