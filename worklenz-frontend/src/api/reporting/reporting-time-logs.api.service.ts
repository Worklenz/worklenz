import apiClient from '../api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { toQueryString } from '@/utils/toQueryString';
import {
  ITimeLogGroupsPage,
  ITimeLogGroupsRequest,
  ITimeLogMemberOption,
  ITimeLogProjectOption,
  ITimeLogsFilterRequest,
  ITimeLogsListRequest,
  ITimeLogsPage,
  TimeLogsGroupDimension,
  TimeLogSortField,
  TimeLogSortOrder,
  TimeLogsExportFormat,
  TimeLogsExportMode,
  TimeLogsTableView,
} from '@/types/reporting/time-logs.types';

const rootUrl = `${API_BASE_URL}/reporting/time-logs`;
const exportUrl = `${import.meta.env.VITE_API_URL}${API_BASE_URL}/reporting-export/time-logs/export`;

export interface ITimeLogsExportParams {
  format: TimeLogsExportFormat;
  mode: TimeLogsExportMode;
  filters: ITimeLogsFilterRequest;
  sortField?: TimeLogSortField;
  sortOrder?: TimeLogSortOrder;
  /** 'task' exports one row per task, like the By task table. Only a "filtered" export honours it. */
  view?: TimeLogsTableView;
  /**
   * Exports the groups of the Member / Project / Client list — every group of the filtered set, not
   * just the page on screen — instead of entries. Only a "filtered" export honours it.
   */
  groupBy?: TimeLogsGroupDimension;
}

/**
 * Builds the export URL. Lists travel comma-separated (the backend splits
 * them); "all" sends only the date range, since every other filter is dropped.
 */
export const buildTimeLogsExportUrl = ({
  format,
  mode,
  filters,
  sortField,
  sortOrder,
  view,
  groupBy,
}: ITimeLogsExportParams): string => {
  const params = new URLSearchParams({ format, mode });
  if (filters.date_from && filters.date_to) {
    params.set('date_from', filters.date_from);
    params.set('date_to', filters.date_to);
  }

  if (mode === 'filtered') {
    if (filters.user_ids?.length) params.set('user_ids', filters.user_ids.join(','));
    if (filters.project_ids?.length) params.set('project_ids', filters.project_ids.join(','));
    if (filters.practice_ids?.length) params.set('practice_ids', filters.practice_ids.join(','));
    if (filters.client_ids?.length) params.set('client_ids', filters.client_ids.join(','));
    if (filters.billable) params.set('billable', JSON.stringify(filters.billable));
    if (filters.search) params.set('search', filters.search);
    if (sortField) {
      params.set('sort_field', sortField);
      if (sortOrder) params.set('sort_order', sortOrder);
    }
    if (view === 'task') params.set('view', view);
    if (groupBy) params.set('group_by', groupBy);
  }

  return `${exportUrl}?${params.toString()}`;
};

export const reportingTimeLogsApiService = {
  getTimeLogs: async (body: ITimeLogsListRequest): Promise<IServerResponse<ITimeLogsPage>> => {
    const response = await apiClient.post<IServerResponse<ITimeLogsPage>>(rootUrl, body);
    return response.data;
  },

  /** One page of Member / Project / Client groups, each a rollup, plus the whole-set totals. */
  getTimeLogGroups: async (
    body: ITimeLogGroupsRequest
  ): Promise<IServerResponse<ITimeLogGroupsPage>> => {
    const response = await apiClient.post<IServerResponse<ITimeLogGroupsPage>>(
      `${rootUrl}/groups`,
      body
    );
    return response.data;
  },

  /** Active members plus deactivated/removed users who logged time in the range. */
  getMembers: async (
    range: { date_from?: string; date_to?: string } = {}
  ): Promise<IServerResponse<ITimeLogMemberOption[]>> => {
    const query = toQueryString({ date_from: range.date_from, date_to: range.date_to });
    const response = await apiClient.get<IServerResponse<ITimeLogMemberOption[]>>(
      `${rootUrl}/members${query}`
    );
    return response.data;
  },

  getProjects: async (): Promise<IServerResponse<ITimeLogProjectOption[]>> => {
    const response = await apiClient.get<IServerResponse<ITimeLogProjectOption[]>>(
      `${rootUrl}/projects`
    );
    return response.data;
  },

  /** Triggers a file download (same navigation-based pattern as the other report exports). */
  exportTimeLogs(params: ITimeLogsExportParams) {
    window.location.href = buildTimeLogsExportUrl(params);
  },
};
