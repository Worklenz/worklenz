import { renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useSessionPersistedState } from './useSessionPersistedState';
import { DEFAULT_TIME_LOGS_FILTERS, isTimeLogsFilterState, toFilterRequest } from '@/pages/reporting/time-sheets/components/time-logs/time-logs-filters';

it('falls back to usable defaults for malformed stored time log filters', () => {
  sessionStorage.setItem('time-logs-test', '{}');
  const { result } = renderHook(() => useSessionPersistedState('time-logs-test', DEFAULT_TIME_LOGS_FILTERS, isTimeLogsFilterState));
  expect(result.current[0]).toEqual(DEFAULT_TIME_LOGS_FILTERS);
  expect(toFilterRequest(result.current[0], '', null)).toEqual({});
});


it.each([
  ['2026-02-30', '2026-03-01'],
  ['invalid', '2026-03-01'],
  ['2026-03-02', '2026-03-01'],
])('rejects an invalid stored range %s to %s', (from, to) => {
  sessionStorage.setItem('time-logs-test', JSON.stringify({ ...DEFAULT_TIME_LOGS_FILTERS, datePreset: 'custom', customRange: [from, to] }));
  const { result } = renderHook(() => useSessionPersistedState('time-logs-test', DEFAULT_TIME_LOGS_FILTERS, isTimeLogsFilterState));
  expect(result.current[0]).toEqual(DEFAULT_TIME_LOGS_FILTERS);
});

it('accepts a valid leap-day range and a null range', () => {
  expect(isTimeLogsFilterState({ ...DEFAULT_TIME_LOGS_FILTERS, datePreset: 'custom', customRange: ['2024-02-29', '2024-03-01'] })).toBe(true);
  expect(isTimeLogsFilterState({ ...DEFAULT_TIME_LOGS_FILTERS, datePreset: 'custom', customRange: null })).toBe(true);
});
