import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api-client', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

import apiClient from '../api-client';
import {
  buildTimeLogsExportUrl,
  reportingTimeLogsApiService,
} from './reporting-time-logs.api.service';

const parse = (url: string) => {
  const [path, query] = url.split('?');
  return { path, params: new URLSearchParams(query) };
};

describe('buildTimeLogsExportUrl', () => {
  it('points at the time-logs export endpoint', () => {
    const { path } = parse(
      buildTimeLogsExportUrl({ format: 'xlsx', mode: 'filtered', filters: {} })
    );
    expect(path).toMatch(/\/reporting-export\/time-logs\/export$/);
  });

  it('sends every filter in filtered mode, with lists comma-separated', () => {
    const { params } = parse(
      buildTimeLogsExportUrl({
        format: 'csv',
        mode: 'filtered',
        filters: {
          date_from: '2026-09-01',
          date_to: '2026-09-30',
          user_ids: ['u1', 'u2'],
          project_ids: ['p1'],
          practice_ids: ['pr1', '__no_practice__'],
          client_ids: ['c1', '__no_client__'],
          billable: { billable: true, nonBillable: false },
          search: 'fix & ship',
        },
        sortField: 'duration',
        sortOrder: 'asc',
      })
    );
    expect(params.get('format')).toBe('csv');
    expect(params.get('mode')).toBe('filtered');
    expect(params.get('date_from')).toBe('2026-09-01');
    expect(params.get('date_to')).toBe('2026-09-30');
    expect(params.get('user_ids')).toBe('u1,u2');
    expect(params.get('project_ids')).toBe('p1');
    expect(params.get('practice_ids')).toBe('pr1,__no_practice__');
    expect(params.get('client_ids')).toBe('c1,__no_client__');
    expect(JSON.parse(params.get('billable') as string)).toEqual({
      billable: true,
      nonBillable: false,
    });
    expect(params.get('search')).toBe('fix & ship');
    expect(params.get('sort_field')).toBe('duration');
    expect(params.get('sort_order')).toBe('asc');
  });

  it("'all' mode keeps only the date range", () => {
    const { params } = parse(
      buildTimeLogsExportUrl({
        format: 'xlsx',
        mode: 'all',
        filters: {
          date_from: '2026-09-01',
          date_to: '2026-09-30',
          user_ids: ['u1'],
          project_ids: ['p1'],
          client_ids: ['c1'],
          search: 'x',
          billable: { billable: true, nonBillable: false },
        },
        sortField: 'date',
        sortOrder: 'desc',
      })
    );
    expect([...params.keys()].sort()).toEqual(['date_from', 'date_to', 'format', 'mode']);
  });

  it('exports one row per task from the By task view, in filtered mode only', () => {
    const filtered = parse(
      buildTimeLogsExportUrl({ format: 'csv', mode: 'filtered', filters: {}, view: 'task' })
    );
    expect(filtered.params.get('view')).toBe('task');

    // "all entries" is always the entries as logged
    const all = parse(
      buildTimeLogsExportUrl({ format: 'csv', mode: 'all', filters: {}, view: 'task' })
    );
    expect(all.params.has('view')).toBe(false);
  });

  it('exports the groups of a grouped screen, in filtered mode only', () => {
    for (const groupBy of ['member', 'project', 'client'] as const) {
      const filtered = parse(
        buildTimeLogsExportUrl({
          format: 'xlsx',
          mode: 'filtered',
          filters: { date_from: '2026-09-01', date_to: '2026-09-30', user_ids: ['u1'] },
          groupBy,
        })
      );
      expect(filtered.params.get('group_by')).toBe(groupBy);
      // every group of the filtered set, never one page of them
      expect(filtered.params.has('page')).toBe(false);
      expect(filtered.params.has('page_size')).toBe(false);
      expect(filtered.params.get('user_ids')).toBe('u1');
    }

    // "all entries" is always the entries as logged
    const all = parse(
      buildTimeLogsExportUrl({ format: 'xlsx', mode: 'all', filters: {}, groupBy: 'member' })
    );
    expect(all.params.has('group_by')).toBe(false);
  });

  it('sends no grouping for the table', () => {
    const { params } = parse(
      buildTimeLogsExportUrl({ format: 'csv', mode: 'filtered', filters: {}, view: 'task' })
    );
    expect(params.has('group_by')).toBe(false);
  });

  it('leaves the view out for the flat table, which is what the server assumes', () => {
    for (const view of ['flat' as const, undefined]) {
      const { params } = parse(
        buildTimeLogsExportUrl({ format: 'csv', mode: 'filtered', filters: {}, view })
      );
      expect(params.has('view')).toBe(false);
    }
  });

  it('omits the date range for "all time"', () => {
    const { params } = parse(buildTimeLogsExportUrl({ format: 'xlsx', mode: 'all', filters: {} }));
    expect(params.has('date_from')).toBe(false);
    expect(params.has('date_to')).toBe(false);
  });
});

describe('reportingTimeLogsApiService', () => {
  beforeEach(() => {
    vi.mocked(apiClient.post).mockReset();
  });

  it('posts the list request, view included, to the time-logs endpoint', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { done: true, body: { logs: [] } } });
    const request = {
      page: 1,
      page_size: 20,
      view: 'task' as const,
      date_from: '2026-09-01',
      date_to: '2026-09-30',
    };
    const response = await reportingTimeLogsApiService.getTimeLogs(request);
    expect(apiClient.post).toHaveBeenCalledWith(
      expect.stringMatching(/\/reporting\/time-logs$/),
      request
    );
    expect(response).toEqual({ done: true, body: { logs: [] } });
  });

  it('posts the group request to the groups endpoint', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { done: true, body: { groups: [] } } });
    const request = { group_by: 'client' as const, page: 2, page_size: 50, user_ids: ['u1'] };
    const response = await reportingTimeLogsApiService.getTimeLogGroups(request);
    expect(apiClient.post).toHaveBeenCalledWith(
      expect.stringMatching(/\/reporting\/time-logs\/groups$/),
      request
    );
    expect(response).toEqual({ done: true, body: { groups: [] } });
  });
});
