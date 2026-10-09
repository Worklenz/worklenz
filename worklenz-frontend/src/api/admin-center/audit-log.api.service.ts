import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { FetchBaseQueryMeta } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from '@/shared/constants';
import { ensureCsrfToken, getCsrfToken } from '@/api/api-client';
import config from '@/config/env';
import { IServerResponse } from '@/types/common.types';
import { IOrganizationUsersGetRequest } from '@/types/admin-center/admin-center.types';
import {
  IAuditLogActorOption,
  IAuditLogExportDownload,
  IAuditLogExportJob,
  IAuditLogExportResult,
  IAuditLogListParams,
  IAuditLogListResponse,
  IAuditLogQueryParams,
  IAuditLogRetention,
  IAuditLogSummary,
} from '@/types/admin-center/audit-log.types';

const rootUrl = '/admin-center/organization';
const ACTOR_OPTIONS_PAGE_SIZE = 50;

export const auditLogApi = createApi({
  reducerPath: 'auditLogApi',
  baseQuery: fetchBaseQuery({
    baseUrl: `${config.apiUrl}${API_BASE_URL}`,
    prepareHeaders: async headers => {
      const token = getCsrfToken() || (await ensureCsrfToken());
      if (token) headers.set('X-CSRF-Token', token);
      headers.set('Content-Type', 'application/json');
      return headers;
    },
    credentials: 'include',
  }),
  tagTypes: ['AuditLogEvents', 'AuditLogRetention', 'AuditLogExport'],
  endpoints: builder => ({
    getAuditEvents: builder.query<IAuditLogListResponse, IAuditLogListParams>({
      query: params => ({ url: `${rootUrl}/audit-log`, params }),
      transformResponse: (response: IServerResponse<IAuditLogListResponse>) =>
        response.body ?? { total: 0, data: [] },
      providesTags: ['AuditLogEvents'],
    }),

    getAuditSummary: builder.query<IAuditLogSummary, IAuditLogQueryParams>({
      query: params => ({ url: `${rootUrl}/audit-log/summary`, params }),
      transformResponse: (response: IServerResponse<IAuditLogSummary>) => response.body,
      providesTags: ['AuditLogEvents'],
    }),

    /** Searchable workspace users for the actor picker (reuses the Admin Center users endpoint). */
    getAuditLogActors: builder.query<IAuditLogActorOption[], string>({
      query: search => ({
        url: `${rootUrl}/users`,
        params: { index: 1, size: ACTOR_OPTIONS_PAGE_SIZE, ...(search && { search }) },
      }),
      transformResponse: (response: IServerResponse<IOrganizationUsersGetRequest>) =>
        (response.body?.data ?? [])
          .filter(user => !!user.user_id)
          .map(user => ({
            value: user.user_id as string,
            label: user.name || user.email || (user.user_id as string),
          })),
    }),

    exportAuditLog: builder.mutation<IAuditLogExportResult, IAuditLogQueryParams>({
      query: filters => ({
        url: `${rootUrl}/audit-log/export`,
        method: 'POST',
        body: filters,
        responseHandler: response =>
          response.headers.get('content-type')?.includes('text/csv')
            ? response.blob()
            : response.json(),
      }),
      transformResponse: (
        response: Blob | IServerResponse<{ mode: 'async'; job: IAuditLogExportJob }>,
        meta: FetchBaseQueryMeta | undefined
      ): IAuditLogExportResult => {
        if (response instanceof Blob) {
          return {
            mode: 'sync',
            blob: response,
            fileName: getFileNameFromDisposition(meta?.response?.headers.get('content-disposition')),
          };
        }
        return { mode: 'async', job: response.body.job };
      },
      invalidatesTags: ['AuditLogExport'],
    }),

    getLatestExportJob: builder.query<IAuditLogExportJob | null, void>({
      query: () => ({ url: `${rootUrl}/audit-log/export/latest` }),
      transformResponse: (response: IServerResponse<IAuditLogExportJob | null>) => response.body,
      providesTags: ['AuditLogExport'],
    }),

    getExportJob: builder.query<IAuditLogExportJob, string>({
      query: jobId => ({ url: `${rootUrl}/audit-log/export/${jobId}` }),
      transformResponse: (response: IServerResponse<IAuditLogExportJob>) => response.body,
    }),

    /** A mutation (not a query) because each call mints a fresh, short-lived download URL. */
    getExportDownloadUrl: builder.mutation<IAuditLogExportDownload, string>({
      query: jobId => ({ url: `${rootUrl}/audit-log/export/${jobId}/download`, method: 'GET' }),
      transformResponse: (response: IServerResponse<IAuditLogExportDownload>) => response.body,
    }),

    getAuditLogRetention: builder.query<IAuditLogRetention, void>({
      query: () => ({ url: `${rootUrl}/audit-log/retention` }),
      transformResponse: (response: IServerResponse<IAuditLogRetention>) => response.body,
      providesTags: ['AuditLogRetention'],
    }),

    updateAuditLogRetention: builder.mutation<IAuditLogRetention, number>({
      query: retentionMonths => ({
        url: `${rootUrl}/audit-log/retention`,
        method: 'PUT',
        body: { retention_months: retentionMonths },
      }),
      transformResponse: (response: IServerResponse<IAuditLogRetention>) => response.body,
      invalidatesTags: ['AuditLogRetention', 'AuditLogEvents'],
    }),
  }),
});

export const getFileNameFromDisposition = (disposition: string | null | undefined): string => {
  const match = disposition?.match(/filename="?([^";]+)"?/i);
  if (match?.[1]) return match[1];
  return `audit-log-export-${new Date().toISOString().slice(0, 10)}.csv`;
};

export const {
  useGetAuditEventsQuery,
  useGetAuditSummaryQuery,
  useGetAuditLogActorsQuery,
  useExportAuditLogMutation,
  useGetLatestExportJobQuery,
  useGetExportJobQuery,
  useGetExportDownloadUrlMutation,
  useGetAuditLogRetentionQuery,
  useUpdateAuditLogRetentionMutation,
} = auditLogApi;
