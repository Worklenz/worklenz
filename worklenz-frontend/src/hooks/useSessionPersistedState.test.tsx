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
