import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from '@/shared/constants';
import { getCsrfToken, ensureCsrfToken } from '../api-client';
import config from '@/config/env';
import {
  PickerType,
  ScheduleData,
  DateList,
  Member,
  Project,
  Settings,
} from '@/types/schedule/schedule-v2.types';
import { IServerResponse } from '@/types/common.types';

const rootUrl = `${config.apiUrl}${API_BASE_URL}/schedule-gannt-v2`;

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
  chartStart?: string;
  chartEnd?: string;
}

interface ScheduleSubmitRequest {
  schedule: ScheduleData;
}

interface SettingsUpdateRequest {
  workingDays: string[];
  workingHours: number;
}

// Task Timeline Types
interface TaskTimelineFilters {
  startDate?: string;
  endDate?: string;
  memberId?: string;
  projectId?: string;
  statusId?: string;
  priorityId?: string;
}

interface TaskTimelineItem {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  parent_task_id: string | null;
  project_id: string;
  project_name: string;
  project_color: string;
  status_id: string;
  status_name: string;
  status_color: string;
  is_done_status: boolean;
  priority_id: string;
  priority_name: string;
  priority_color: string;
  done: boolean;
  total_minutes: number;
  assignees: Array<{
    id: string;
    user_id: string;
    name: string;
    email: string;
    avatar_url: string | null;
  }>;
  subtask_count: number;
  completed_subtask_count: number;
}

interface UpdateTaskDatesRequest {
  taskId: string;
  start_date: string | null;
  end_date: string | null;
}

interface TaskConflict {
  type: 'time-off' | 'overallocation';
  severity: 'low' | 'medium' | 'high';
  message: string;
  details: any;
}

// Time-Off Types
interface TimeOffEntry {
  id: string;
  team_member_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  created_at: string;
  member_name: string;
  member_email: string;
  member_avatar: string | null;
}

interface TimeOffFilters {
  teamMemberId?: string;
  startDate?: string;
  endDate?: string;
}

interface CreateTimeOffRequest {
  team_member_id: string;
  start_date: string;
  end_date: string;
  reason?: string;
}

interface UpdateTimeOffRequest {
  id: string;
  start_date?: string;
  end_date?: string;
  reason?: string;
}

interface TimeOffSummary {
  team_member_id: string;
  member_name: string;
  member_email: string;
  time_off_periods: Array<{
    id: string;
    start_date: string;
    end_date: string;
    reason: string | null;
  }>;
  total_days_off: number;
}

export const scheduleApi = createApi({
  reducerPath: 'scheduleApi',
  baseQuery: fetchBaseQuery({
    baseUrl: rootUrl,
    credentials: 'include',
    prepareHeaders: async (headers, { endpoint, type }) => {
      // Add authentication headers
      headers.set('Content-Type', 'application/json');
      headers.set('Accept', 'application/json');

      // Add CSRF token for state-changing requests
      const isStateChanging = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(type || '');
      if (isStateChanging) {
        // Ensure CSRF token is available
        await ensureCsrfToken();
        const csrfToken = getCsrfToken();
        if (csrfToken) {
          headers.set('X-CSRF-Token', csrfToken);
        }
      }

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
    'TaskTimeline',
    'TimeOff',
    'Capacity',
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
      query: ({ id, chartStart, chartEnd }) => {
        const params = new URLSearchParams();
        if (chartStart) params.append('chartStart', chartStart);
        if (chartEnd) params.append('chartEnd', chartEnd);
        return `/members/projects/${id}${params.toString() ? `?${params.toString()}` : ''}`;
      },
      providesTags: (result, error, { id, chartStart }) => [
        { type: 'MemberProjects' as const, id },
        { type: 'MemberProjects' as const, id: `${id}-${chartStart}` },
        // Add more granular tags for better cache management
        { type: 'TaskTimeline' as const, id: `member-${id}` },
        'Workload', // General workload tag for broader invalidation
      ],
      // Keep data fresh for real-time updates but allow some caching
      keepUnusedDataFor: 10, // Reduced from 30 to 10 seconds for more responsive updates
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

    // ============================================
    // Task Timeline Endpoints (NEW)
    // ============================================
    fetchTaskTimeline: builder.query<IServerResponse<TaskTimelineItem[]>, TaskTimelineFilters>({
      query: filters => {
        const params = new URLSearchParams();
        if (filters.startDate) params.append('startDate', filters.startDate);
        if (filters.endDate) params.append('endDate', filters.endDate);
        if (filters.memberId) params.append('memberId', filters.memberId);
        if (filters.projectId) params.append('projectId', filters.projectId);
        if (filters.statusId) params.append('statusId', filters.statusId);
        if (filters.priorityId) params.append('priorityId', filters.priorityId);
        return `/tasks?${params.toString()}`;
      },
      providesTags: ['TaskTimeline'],
    }),

    updateTaskDates: builder.mutation<IServerResponse<any>, UpdateTaskDatesRequest>({
      query: ({ taskId, start_date, end_date }) => ({
        url: `/tasks/${taskId}/dates`,
        method: 'PUT',
        body: { start_date, end_date },
      }),
      invalidatesTags: ['TaskTimeline', 'Workload'],
      // Optimistic update
      async onQueryStarted({ taskId, start_date, end_date }, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } catch (error) {
          console.error('Failed to update task dates:', error);
        }
      },
    }),

    fetchTaskConflicts: builder.query<IServerResponse<{ conflicts: TaskConflict[] }>, string>({
      query: taskId => `/tasks/${taskId}/conflicts`,
      providesTags: ['Conflicts'],
    }),

    // ============================================
    // Time-Off Endpoints (NEW)
    // ============================================
    fetchTimeOff: builder.query<IServerResponse<TimeOffEntry[]>, TimeOffFilters>({
      query: filters => {
        const params = new URLSearchParams();
        if (filters.teamMemberId) params.append('teamMemberId', filters.teamMemberId);
        if (filters.startDate) params.append('startDate', filters.startDate);
        if (filters.endDate) params.append('endDate', filters.endDate);
        return `/time-off?${params.toString()}`;
      },
      providesTags: ['TimeOff'],
    }),

    fetchTimeOffSummary: builder.query<
      IServerResponse<TimeOffSummary[]>,
      { startDate: string; endDate: string }
    >({
      query: ({ startDate, endDate }) =>
        `/time-off/summary?startDate=${startDate}&endDate=${endDate}`,
      providesTags: ['TimeOff'],
    }),

    createTimeOff: builder.mutation<IServerResponse<TimeOffEntry>, CreateTimeOffRequest>({
      query: body => ({
        url: '/time-off',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['TimeOff', 'TaskTimeline'],
    }),

    updateTimeOff: builder.mutation<IServerResponse<TimeOffEntry>, UpdateTimeOffRequest>({
      query: ({ id, ...body }) => ({
        url: `/time-off/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['TimeOff', 'TaskTimeline'],
    }),

    deleteTimeOff: builder.mutation<IServerResponse<null>, string>({
      query: id => ({
        url: `/time-off/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['TimeOff', 'TaskTimeline'],
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

    // ============================================
    // Capacity Management Endpoints (NEW)
    // ============================================
    fetchDailyCapacity: builder.query<
      IServerResponse<any[]>,
      { startDate: string; endDate: string; teamMemberId?: string }
    >({
      query: ({ startDate, endDate, teamMemberId }) => {
        const params = new URLSearchParams();
        params.append('startDate', startDate);
        params.append('endDate', endDate);
        if (teamMemberId) params.append('teamMemberId', teamMemberId);
        return `/capacity/daily?${params.toString()}`;
      },
      providesTags: ['Capacity'],
    }),

    fetchCapacitySummary: builder.query<
      IServerResponse<any>,
      { startDate: string; endDate: string }
    >({
      query: ({ startDate, endDate }) =>
        `/capacity/summary?startDate=${startDate}&endDate=${endDate}`,
      providesTags: ['Capacity'],
    }),

    fetchCapacityConflicts: builder.query<
      IServerResponse<any[]>,
      { startDate: string; endDate: string }
    >({
      query: ({ startDate, endDate }) =>
        `/capacity/conflicts?startDate=${startDate}&endDate=${endDate}`,
      providesTags: ['Capacity'],
    }),

    // Member Schedule Summary
    fetchMemberScheduleSummary: builder.query<
      IServerResponse<any>,
      { memberId: string; startDate: string; endDate: string; projectId?: string }
    >({
      query: ({ memberId, startDate, endDate, projectId }) => {
        const params = new URLSearchParams();
        params.append('startDate', startDate);
        params.append('endDate', endDate);
        if (projectId) params.append('projectId', projectId);
        return `/members/${memberId}/summary?${params.toString()}`;
      },
      providesTags: ['Members'],
    }),

    // Fetch tasks for a specific project and member (old schedule controller)
    // Note: This uses the OLD schedule API at /api/schedule-gannt (not v2)
    fetchProjectMemberTasks: builder.query<
      IServerResponse<any>,
      { projectId: string; memberId: string; startDate?: string; endDate?: string; group?: string }
    >({
      query: ({ projectId, memberId, startDate, endDate, group }) => {
        const params = new URLSearchParams();
        // Member filtering is done via 'members' query param (space-separated member IDs)
        params.append('members', memberId);
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (group) params.append('group', group);
        // Use the old schedule API endpoint - need to go up one level from schedule-gannt-v2 to schedule-gannt
        return `/../schedule-gannt/tasks-by-member/${projectId}?${params.toString()}`;
      },
      providesTags: ['TaskTimeline'],
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

  // Task Timeline hooks (NEW)
  useFetchTaskTimelineQuery,
  useLazyFetchTaskTimelineQuery,
  useUpdateTaskDatesMutation,
  useFetchTaskConflictsQuery,
  useLazyFetchTaskConflictsQuery,

  // Time-Off hooks (NEW)
  useFetchTimeOffQuery,
  useLazyFetchTimeOffQuery,
  useFetchTimeOffSummaryQuery,
  useCreateTimeOffMutation,
  useUpdateTimeOffMutation,
  useDeleteTimeOffMutation,

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

  // Capacity Management hooks (NEW)
  useFetchDailyCapacityQuery,
  useLazyFetchDailyCapacityQuery,
  useFetchCapacitySummaryQuery,
  useFetchCapacityConflictsQuery,

  // Member Schedule Summary hooks
  useFetchMemberScheduleSummaryQuery,
  useLazyFetchMemberScheduleSummaryQuery,

  // Project Member Tasks hooks
  useFetchProjectMemberTasksQuery,
  useLazyFetchProjectMemberTasksQuery,
} = scheduleApi;

// Export the reducer
export default scheduleApi.reducer;

// Export util for manual cache management
export const {
  util: scheduleApiUtil,
  endpoints: scheduleApiEndpoints,
  reducerPath: scheduleApiReducerPath,
} = scheduleApi;
