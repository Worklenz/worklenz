import { describe, expect, it } from 'vitest';
import dayjs from 'dayjs';
import {
  DEFAULT_AUDIT_LOG_FILTERS,
  IAuditLogFilterState,
  getAuditLogNow,
  hasActiveAuditLogFilters,
  toAuditLogQueryParams,
} from './audit-log-filters';
import reducer, {
  dismissExportJob,
  resetFilters,
  setCategoryFilter,
  setPagination,
  setSearch,
  trackExportJob,
} from './audit-log.slice';

const NOW = dayjs('2026-10-06T12:00:00');

const withFilters = (overrides: Partial<IAuditLogFilterState>): IAuditLogFilterState => ({
  ...DEFAULT_AUDIT_LOG_FILTERS,
  ...overrides,
});

describe('toAuditLogQueryParams', () => {
  it('sends the default "today" range and nothing else', () => {
    expect(toAuditLogQueryParams(DEFAULT_AUDIT_LOG_FILTERS, {}, NOW)).toEqual({
      start_date: '2026-10-06',
      end_date: '2026-10-06',
    });
  });

  it('sends the "last 7 days" range when picked', () => {
    expect(toAuditLogQueryParams(withFilters({ datePreset: 'last_7_days' }), {}, NOW)).toEqual({
      start_date: '2026-09-29',
      end_date: '2026-10-05',
    });
  });

  it('omits the date range for "all time"', () => {
    expect(toAuditLogQueryParams(withFilters({ datePreset: 'all_time' }), {}, NOW)).toEqual({});
  });

  it('uses the picked custom range', () => {
    const params = toAuditLogQueryParams(
      withFilters({ datePreset: 'custom', customRange: ['2026-01-01', '2026-01-31'] }),
      {},
      NOW
    );
    expect(params).toEqual({ start_date: '2026-01-01', end_date: '2026-01-31' });
  });

  it('comma-joins categories and actors and trims the search', () => {
    const params = toAuditLogQueryParams(
      withFilters({
        datePreset: 'all_time',
        categories: ['access', 'user'],
        actorUserIds: ['u1', 'u2'],
        search: '  role  ',
      }),
      {},
      NOW
    );
    expect(params).toEqual({ category: 'access,user', actor_user_id: 'u1,u2', search: 'role' });
  });

  it('leaves categories out for the summary request', () => {
    const params = toAuditLogQueryParams(
      withFilters({ datePreset: 'all_time', categories: ['access'] }),
      { includeCategories: false },
      NOW
    );
    expect(params).toEqual({});
  });

  it('drops a whitespace-only search', () => {
    expect(toAuditLogQueryParams(withFilters({ datePreset: 'all_time', search: '   ' }), {}, NOW)).toEqual({});
  });
});

describe('getAuditLogNow', () => {
  // 2026-10-13 20:00 UTC is already Oct 14 in Colombo (UTC+5:30) but still Oct 13 in New York.
  const INSTANT = new Date('2026-10-13T20:00:00Z');

  it("uses the profile timezone's calendar date for today", () => {
    expect(getAuditLogNow('Asia/Colombo', INSTANT).format('YYYY-MM-DD')).toBe('2026-10-14');
    expect(getAuditLogNow('America/New_York', INSTANT).format('YYYY-MM-DD')).toBe('2026-10-13');
  });

  it('sends that date as the "today" range', () => {
    expect(toAuditLogQueryParams(DEFAULT_AUDIT_LOG_FILTERS, {}, getAuditLogNow('Asia/Colombo', INSTANT))).toEqual({
      start_date: '2026-10-14',
      end_date: '2026-10-14',
    });
  });

  it('falls back to the browser clock for a missing or unknown zone', () => {
    const local = dayjs(INSTANT).format('YYYY-MM-DD');
    expect(getAuditLogNow(undefined, INSTANT).format('YYYY-MM-DD')).toBe(local);
    expect(getAuditLogNow('Mars/Olympus_Mons', INSTANT).format('YYYY-MM-DD')).toBe(local);
  });
});

describe('hasActiveAuditLogFilters', () => {
  it('is false for the defaults', () => {
    expect(hasActiveAuditLogFilters(DEFAULT_AUDIT_LOG_FILTERS)).toBe(false);
  });

  it.each([
    ['a different date preset', { datePreset: 'last_7_days' as const }],
    ['a category', { categories: ['lifecycle' as const] }],
    ['an actor', { actorUserIds: ['u1'] }],
    ['a search', { search: 'login' }],
  ])('is true with %s', (_label, overrides) => {
    expect(hasActiveAuditLogFilters(withFilters(overrides))).toBe(true);
  });
});

describe('audit log slice', () => {
  const initial = reducer(undefined, { type: 'init' });

  it('returns to page 1 whenever a filter changes', () => {
    const onPage3 = reducer(initial, setPagination({ page: 3, pageSize: initial.pageSize }));
    expect(onPage3.page).toBe(3);
    expect(reducer(onPage3, setSearch('role')).page).toBe(1);
    expect(reducer(onPage3, setCategoryFilter(['access'])).page).toBe(1);
  });

  it('returns to page 1 when the page size changes', () => {
    const next = reducer(initial, setPagination({ page: 4, pageSize: 50 }));
    expect(next).toMatchObject({ page: 1, pageSize: 50 });
  });

  it('resets every filter to the defaults', () => {
    const filtered = reducer(reducer(initial, setSearch('role')), setCategoryFilter(['user']));
    expect(reducer(filtered, resetFilters()).filters).toEqual(DEFAULT_AUDIT_LOG_FILTERS);
  });

  it('remembers a dismissed export job so it is not resumed again', () => {
    const tracking = reducer(initial, trackExportJob('job-1'));
    const dismissed = reducer(tracking, dismissExportJob());
    expect(dismissed).toMatchObject({ exportJobId: null, dismissedExportJobId: 'job-1' });
  });
});
