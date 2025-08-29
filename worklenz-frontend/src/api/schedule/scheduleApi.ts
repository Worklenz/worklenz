import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from '@/shared/constants';
import {
  PickerType,
  ScheduleData,
  DateList,
  Member,
  Project,
  Settings,
} from '@/types/schedule/schedule-v2.types';
import { IServerResponse } from '@/types/common.types';

const rootUrl = `${API_BASE_URL}/schedule-gannt-v2`;

// Define types for RTK Query
interface WorkloadData {
  id: string;
  name: string;
  totalHours: number;
  allocatedHours: number;
  availableHours: number;
  utilizationPercent: number;
  projectCount: number;
  status: 'available' | 'normal' | 'fully-allocated' | 'overallocated';
  conflicts?: Array<{
    type: 'overallocation' | 'schedule-conflict';
    message: string;
    severity: 'low' | 'medium' | 'high';
  }>;
}

interface ResourceAllocation {
  memberId: string;
  projectId: string;
  allocatedHours: number;
  startDate?: string;
  endDate?: string;
}

interface RebalanceRequest {
  memberIds?: string[];
  strategy?: 'even' | 'skills' | 'priority';
  maxUtilization?: number;
}

interface CapacityReportRequest {
  startDate: string;
  endDate: string;
  teamId?: string;
}

interface WorkloadRequest {
  memberId?: string;
  startDate?: string;
  endDate?: string;
}

interface DateRequest {
  type: string;
  date: string;
}

interface MemberProjectsRequest {
  id: string;
}

interface ScheduleSubmitRequest {
  schedule: ScheduleData;
}

interface SettingsUpdateRequest {
  workingDays: string[];
  workingHours: number;
}

export const scheduleApi = createApi({
  reducerPath: 'scheduleApi',
  baseQuery: fetchBaseQuery({
    baseUrl: rootUrl,
    prepareHeaders: (headers, { getState }) => {
      // Add authentication headers if needed
      headers.set('Content-Type', 'application/json');
      return headers;
    },
  }),
  tagTypes: [
    'Settings',
    'DateList',
    'Members',
    'MemberProjects',
    'Workload',
    'Allocation',
    'CapacityReport',
    'Conflicts',
  ],
  endpoints: builder => ({
    // Settings endpoints
    fetchScheduleSettings: builder.query<IServerResponse<Settings>, void>({
      query: () => '/settings',
      providesTags: ['Settings'],
    }),

    updateScheduleSettings: builder.mutation<IServerResponse<any>, SettingsUpdateRequest>({
      query: ({ workingDays, workingHours }) => ({
        url: '/settings',
        method: 'PUT',
        body: { workingDays, workingHours },
      }),
      invalidatesTags: ['Settings'],
    }),

    // Date and timeline endpoints
    fetchScheduleDates: builder.query<IServerResponse<DateList>, DateRequest>({
      query: ({ type, date }) => `/dates/${date}/${type}`,
      providesTags: ['DateList'],
    }),

    // Members and projects endpoints
    fetchScheduleMembers: builder.query<IServerResponse<Member[]>, void>({
      query: () => '/members',
      providesTags: ['Members'],
    }),

    fetchMemberProjects: builder.query<IServerResponse<Project>, MemberProjectsRequest>({
      query: ({ id }) => `/members/projects/${id}`,
      providesTags: (result, error, { id }) => [{ type: 'MemberProjects' as const, id }],
    }),

    // Schedule submission
    submitScheduleData: builder.mutation<IServerResponse<any>, ScheduleSubmitRequest>({
      query: ({ schedule }) => ({
        url: '/schedule',
        method: 'POST',
        body: schedule,
      }),
      invalidatesTags: ['Members', 'Workload'],
    }),

    // Resource Management & Workload endpoints
    fetchMemberWorkload: builder.query<IServerResponse<WorkloadData[]>, WorkloadRequest>({
      query: ({ memberId, startDate, endDate }) => {
        const params = new URLSearchParams();
        if (memberId) params.append('memberId', memberId);
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);

        return `/workload?${params.toString()}`;
      },
      providesTags: ['Workload'],
    }),

    updateResourceAllocation: builder.mutation<IServerResponse<any>, ResourceAllocation>({
      query: ({ memberId, projectId, allocatedHours, startDate, endDate }) => ({
        url: '/allocation',
        method: 'PUT',
        body: {
          memberId,
          projectId,
          allocatedHours,
          startDate,
          endDate,
        },
      }),
      invalidatesTags: ['Workload', 'Members', 'Allocation'],
      // Optimistic update
      async onQueryStarted({ memberId, projectId, allocatedHours }, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          // Invalidate related queries after successful update
          dispatch(scheduleApi.util.invalidateTags(['Workload', 'Members']));
        } catch (error) {
          console.error('Failed to update resource allocation:', error);
        }
      },
    }),

    rebalanceWorkload: builder.mutation<IServerResponse<any>, RebalanceRequest>({
      query: ({ memberIds, strategy = 'even', maxUtilization = 100 }) => ({
        url: '/rebalance',
        method: 'POST',
        body: {
          memberIds,
          strategy,
          maxUtilization,
        },
      }),
      invalidatesTags: ['Workload', 'Members', 'Allocation'],
    }),

    fetchCapacityReport: builder.query<IServerResponse<any>, CapacityReportRequest>({
      query: ({ startDate, endDate, teamId }) => {
        const params = new URLSearchParams({
          startDate,
          endDate,
        });
        if (teamId) params.append('teamId', teamId);

        return `/capacity-report?${params.toString()}`;
      },
      providesTags: ['CapacityReport'],
    }),

    fetchResourceConflicts: builder.query<IServerResponse<any>, void>({
      query: () => '/conflicts',
      providesTags: ['Conflicts'],
    }),

    // Bulk operations
    bulkUpdateAllocations: builder.mutation<IServerResponse<any>, ResourceAllocation[]>({
      query: allocations => ({
        url: '/allocations/bulk',
        method: 'PUT',
        body: { allocations },
      }),
      invalidatesTags: ['Workload', 'Members', 'Allocation'],
    }),

    // Analytics endpoints
    fetchUtilizationAnalytics: builder.query<
      IServerResponse<any>,
      { startDate: string; endDate: string }
    >({
      query: ({ startDate, endDate }) => {
        const params = new URLSearchParams({ startDate, endDate });
        return `/analytics/utilization?${params.toString()}`;
      },
      providesTags: ['Workload'],
    }),

    fetchProjectTimeline: builder.query<IServerResponse<any>, { projectId: string }>({
      query: ({ projectId }) => `/timeline/project/${projectId}`,
      providesTags: (result, error, { projectId }) => [
        { type: 'MemberProjects' as const, id: projectId },
      ],
    }),

    // Real-time updates (for WebSocket integration)
    subscribeToWorkloadUpdates: builder.query<any, { memberId?: string }>({
      query: ({ memberId }) => ({
        url: `/subscribe/workload${memberId ? `?memberId=${memberId}` : ''}`,
        method: 'GET',
      }),
      providesTags: ['Workload'],
      // This would be used with WebSocket integration
      keepUnusedDataFor: 0, // Don't cache subscription data
    }),
  }),
});

export const {
  // Settings hooks
  useFetchScheduleSettingsQuery,
  useUpdateScheduleSettingsMutation,

  // Date and timeline hooks
  useFetchScheduleDatesQuery,
  useLazyFetchScheduleDatesQuery,

  // Members and projects hooks
  useFetchScheduleMembersQuery,
  useFetchMemberProjectsQuery,
  useLazyFetchMemberProjectsQuery,

  // Schedule submission hooks
  useSubmitScheduleDataMutation,

  // Resource Management & Workload hooks
  useFetchMemberWorkloadQuery,
  useLazyFetchMemberWorkloadQuery,
  useUpdateResourceAllocationMutation,
  useRebalanceWorkloadMutation,
  useFetchCapacityReportQuery,
  useLazyFetchCapacityReportQuery,
  useFetchResourceConflictsQuery,

  // Bulk operations hooks
  useBulkUpdateAllocationsMutation,

  // Analytics hooks
  useFetchUtilizationAnalyticsQuery,
  useFetchProjectTimelineQuery,

  // Real-time hooks
  useSubscribeToWorkloadUpdatesQuery,
} = scheduleApi;

// Export the reducer
export default scheduleApi.reducer;

// Export util for manual cache management
export const {
  util: scheduleApiUtil,
  endpoints: scheduleApiEndpoints,
  reducerPath: scheduleApiReducerPath,
} = scheduleApi;
