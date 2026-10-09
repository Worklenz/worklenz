import { afterEach, describe, expect, it, vi } from 'vitest';
import dayjs from 'dayjs';

// constants.ts pulls icons from the full antd barrel, which is slow to load cold and
// irrelevant here; a stub keeps each fresh import fast.
vi.mock('@/shared/antd-imports', () => ({
  CheckCircleOutlined: () => null,
  ClockCircleOutlined: () => null,
  CloseCircleOutlined: () => null,
  StopOutlined: () => null,
}));

// `durations` is built when the module loads, so each test pins the clock first
// and imports a fresh copy.
const loadDurationsAt = async (now: Date) => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(now);
  return await import('./constants');
};

const rangeOf = (durations: { key: string; dates?: string }[], key: string): [string, string] => {
  const entry = durations.find(d => d.key === key);
  const [from, to] = (entry?.dates ?? '').split(' - ');
  return [dayjs(from).format('YYYY-MM-DD'), dayjs(to).format('YYYY-MM-DD')];
};

afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
});

describe('shared report durations', () => {
  it('"Last Month" covers the whole previous month even when run on Sep 30 (was Aug 01 – Aug 30)', async () => {
    const { durations, PREV_MONTH } = await loadDurationsAt(new Date(2026, 8, 30, 21, 30));
    expect(rangeOf(durations, PREV_MONTH)).toEqual(['2026-08-01', '2026-08-31']);
  });

  it('"Last Month" covers all of January when run in February', async () => {
    const { durations, PREV_MONTH } = await loadDurationsAt(new Date(2026, 1, 10, 9, 0));
    expect(rangeOf(durations, PREV_MONTH)).toEqual(['2026-01-01', '2026-01-31']);
  });

  it('offers "This Month" as the 1st through today', async () => {
    const { durations, THIS_MONTH } = await loadDurationsAt(new Date(2026, 8, 17, 21, 30));
    const entry = durations.find(d => d.key === THIS_MONTH);
    expect(entry?.label).toBe('thisMonthText');
    expect(rangeOf(durations, THIS_MONTH)).toEqual(['2026-09-01', '2026-09-17']);
  });

  it('keeps Today and Yesterday where index-based callers expect them', async () => {
    const { durations, TODAY, YESTERDAY } = await loadDurationsAt(new Date(2026, 8, 17, 12, 0));
    // membersReportsSlice / ProjectTimeLogDrawer default to durations[1]
    expect(durations[0].key).toBe(TODAY);
    expect(durations[1].key).toBe(YESTERDAY);
    expect(dayjs(durations[1].dates).format('YYYY-MM-DD')).toBe('2026-09-16');
  });

  it('keeps every other preset and the unbounded "All Time"', async () => {
    const { durations, LAST_WEEK, PREV_WEEK, LAST_MONTH, LAST_QUARTER, ALL_TIME } =
      await loadDurationsAt(new Date(2026, 8, 30, 21, 30));
    expect(rangeOf(durations, LAST_WEEK)).toEqual(['2026-09-23', '2026-09-29']);
    expect(rangeOf(durations, LAST_MONTH)).toEqual(['2026-08-31', '2026-09-29']);
    expect(rangeOf(durations, LAST_QUARTER)).toEqual(['2026-06-30', '2026-09-30']);
    expect(rangeOf(durations, PREV_WEEK)[0] < rangeOf(durations, PREV_WEEK)[1]).toBe(true);
    expect(durations.find(d => d.key === ALL_TIME)?.dates).toBe('');
  });
});
