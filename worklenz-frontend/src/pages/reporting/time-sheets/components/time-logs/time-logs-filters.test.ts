import { describe, expect, it } from 'vitest';
import dayjs from 'dayjs';
import {
  DEFAULT_TIME_LOGS_DATE_PRESET,
  DEFAULT_TIME_LOGS_FILTERS,
  ITimeLogsFilterState,
  NO_CLIENT_FILTER_ID,
  NO_PRACTICE_FILTER_ID,
  areFiltersEqual,
  countActiveFilters,
  formatResolvedRange,
  isApplicable,
  normalizeFilters,
  resolveDateRange,
  toBillableRequest,
  toFilterRequest,
} from './time-logs-filters';

const withFilters = (changes: Partial<ITimeLogsFilterState>): ITimeLogsFilterState => ({
  ...DEFAULT_TIME_LOGS_FILTERS,
  ...changes,
});

describe('default filters', () => {
  it('open on this week, from the start of the week through today', () => {
    expect(DEFAULT_TIME_LOGS_FILTERS.datePreset).toBe('this_week');
    expect(DEFAULT_TIME_LOGS_DATE_PRESET).toBe('this_week');
    // Wednesday 30 Sep 2026; the week starts on the dayjs locale's first day (Sunday for "en")
    expect(resolveDateRange(DEFAULT_TIME_LOGS_FILTERS, dayjs('2026-09-30').hour(21))).toEqual({
      from: '2026-09-27',
      to: '2026-09-30',
    });
  });
});

describe('resolveDateRange', () => {
  const evening = dayjs('2026-09-30').hour(21);

  it('resolves a relative preset against the clock it is given', () => {
    expect(resolveDateRange(withFilters({ datePreset: 'this_month' }), evening)).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(resolveDateRange(withFilters({ datePreset: 'last_month' }), evening)).toEqual({
      from: '2026-08-01',
      to: '2026-08-31',
    });
  });

  it('returns the picked custom range, or null until one is picked', () => {
    expect(
      resolveDateRange(
        withFilters({ datePreset: 'custom', customRange: ['2026-09-05', '2026-09-12'] })
      )
    ).toEqual({ from: '2026-09-05', to: '2026-09-12' });
    expect(resolveDateRange(withFilters({ datePreset: 'custom', customRange: null }))).toBeNull();
  });

  it("'all time' has no bounds", () => {
    expect(resolveDateRange(withFilters({ datePreset: 'all_time' }))).toBeNull();
  });
});

describe('formatResolvedRange', () => {
  it('formats a range, a single day and an unbounded range', () => {
    expect(formatResolvedRange({ from: '2026-09-01', to: '2026-09-17' })).toBe(
      'Sep 1, 2026 – Sep 17, 2026'
    );
    expect(formatResolvedRange({ from: '2026-09-17', to: '2026-09-17' })).toBe('Sep 17, 2026');
    expect(formatResolvedRange(null)).toBeNull();
  });
});

describe('toBillableRequest', () => {
  it('sends a filter only when exactly one side is selected', () => {
    expect(toBillableRequest([])).toBeUndefined();
    expect(toBillableRequest(['billable', 'non_billable'])).toBeUndefined();
    expect(toBillableRequest(['billable'])).toEqual({ billable: true, nonBillable: false });
    expect(toBillableRequest(['non_billable'])).toEqual({ billable: false, nonBillable: true });
  });
});

describe('toFilterRequest', () => {
  const range = { from: '2026-09-01', to: '2026-09-17' };

  it('sends only the date range for the default state', () => {
    expect(toFilterRequest(DEFAULT_TIME_LOGS_FILTERS, '', range)).toEqual({
      date_from: '2026-09-01',
      date_to: '2026-09-17',
    });
  });

  it('omits the date range for "all time"', () => {
    expect(toFilterRequest(DEFAULT_TIME_LOGS_FILTERS, '', null)).toEqual({});
  });

  it('maps every filter and trims the search', () => {
    const request = toFilterRequest(
      withFilters({
        userIds: ['u1', 'u2'],
        projectIds: ['p1'],
        practiceIds: ['pr1', NO_PRACTICE_FILTER_ID],
        clientIds: ['c1', NO_CLIENT_FILTER_ID],
        billable: ['billable'],
      }),
      '  invoice  ',
      range
    );
    expect(request).toEqual({
      date_from: '2026-09-01',
      date_to: '2026-09-17',
      user_ids: ['u1', 'u2'],
      project_ids: ['p1'],
      practice_ids: ['pr1', NO_PRACTICE_FILTER_ID],
      client_ids: ['c1', NO_CLIENT_FILTER_ID],
      billable: { billable: true, nonBillable: false },
      search: 'invoice',
    });
  });

  it('never sends empty lists or a blank search', () => {
    const request = toFilterRequest(
      withFilters({ billable: ['billable', 'non_billable'] }),
      '   ',
      range
    );
    expect(Object.keys(request).sort()).toEqual(['date_from', 'date_to']);
  });
});

describe('countActiveFilters', () => {
  it('is zero for the defaults', () => {
    expect(countActiveFilters(DEFAULT_TIME_LOGS_FILTERS)).toBe(0);
  });

  it('counts a date range other than the default (this week) as active', () => {
    expect(countActiveFilters(withFilters({ datePreset: 'this_week' }))).toBe(0);
    expect(countActiveFilters(withFilters({ datePreset: 'last_7_days' }))).toBe(1);
    expect(countActiveFilters(withFilters({ datePreset: 'all_time' }))).toBe(1);
  });

  it('counts a client selection (including "No client") as one active filter', () => {
    expect(countActiveFilters(withFilters({ clientIds: [NO_CLIENT_FILTER_ID] }))).toBe(1);
  });

  it('counts each filter group once, however many values it holds', () => {
    expect(
      countActiveFilters(
        withFilters({
          datePreset: 'this_month',
          userIds: ['a', 'b', 'c'],
          projectIds: ['p'],
          practiceIds: ['x'],
          clientIds: ['c1', 'c2'],
          billable: ['non_billable'],
        })
      )
    ).toBe(6);
  });

  it('does not count a billable selection that cancels itself out', () => {
    expect(countActiveFilters(withFilters({ billable: ['billable', 'non_billable'] }))).toBe(0);
  });
});

describe('isApplicable / normalizeFilters / areFiltersEqual', () => {
  it('blocks a custom range that is not fully picked', () => {
    expect(isApplicable(withFilters({ datePreset: 'custom', customRange: null }))).toBe(false);
    expect(
      isApplicable(withFilters({ datePreset: 'custom', customRange: ['2026-09-01', '2026-09-02'] }))
    ).toBe(true);
    expect(isApplicable(withFilters({ datePreset: 'this_month' }))).toBe(true);
  });

  it('drops a stale custom range and a redundant billable selection', () => {
    const normalized = normalizeFilters(
      withFilters({
        datePreset: 'this_month',
        customRange: ['2026-01-01', '2026-01-02'],
        billable: ['billable', 'non_billable'],
      })
    );
    expect(normalized.customRange).toBeNull();
    expect(normalized.billable).toEqual([]);
  });

  it('treats equivalent states as equal', () => {
    expect(
      areFiltersEqual(
        withFilters({ billable: ['billable', 'non_billable'] }),
        withFilters({ customRange: ['2026-01-01', '2026-01-02'] })
      )
    ).toBe(true);
    expect(areFiltersEqual(withFilters({ userIds: ['a'] }), withFilters({ userIds: ['b'] }))).toBe(
      false
    );
  });
});
