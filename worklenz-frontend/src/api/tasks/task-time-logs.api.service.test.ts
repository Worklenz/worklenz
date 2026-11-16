import { afterEach, describe, expect, it, vi } from 'vitest';
import { taskTimeLogsApiService } from './task-time-logs.api.service';

vi.mock('@/config/env', () => ({ default: { apiUrl: 'https://runtime-api.example.com' } }));
vi.mock('../api-client', () => ({ default: {} }));

afterEach(() => vi.unstubAllGlobals());

describe('time entries CSV export', () => {
  it.each(['filtered', 'all'] as const)('uses the configured API URL for %s exports', mode => {
    const location = { href: '' };
    vi.stubGlobal('window', { location });

    taskTimeLogsApiService.exportMyTimeLogEntriesCsv({ mode, scope: 'my', search: 'design & planning' });

    expect(location.href).toBe(
      `https://runtime-api.example.com/api/v1/task-time-log/export-csv?mode=${mode}&scope=my&search=design%20%26%20planning`
    );
  });
});
