import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from '@/shared/constants';
import {
  IWorkloadData,
  IWorkloadMember,
  ITaskAllocation,
  IMemberAvailability,
} from '@/types/workload/workload.types';
import { getCsrfToken, ensureCsrfToken } from '../api-client';
import config from '@/config/env';

// Helper function to calculate working days per week from organization settings
const calculateWorkingDaysPerWeek = (workingDays: any): number => {
  if (!workingDays) return 5; // Default to 5 days if no working days data

  const days = {
    monday: workingDays.monday || false,
    tuesday: workingDays.tuesday || false,
    wednesday: workingDays.wednesday || false,
    thursday: workingDays.thursday || false,
    friday: workingDays.friday || false,
    saturday: workingDays.saturday || false,
    sunday: workingDays.sunday || false,
  };

  return Object.values(days).filter(Boolean).length;
};

// Transform backend data to frontend interface
const transformToWorkloadData = (data: any): IWorkloadData => {
  // Add null checks for the data parameter
  if (!data) {
    console.warn('transformToWorkloadData received null/undefined data');
    data = {};
  }

  const { chartDates, members = [], tasks = [] } = data;

  // Additional safety checks
  const safeMembers = Array.isArray(members) ? members : [];
  const safeTasks = Array.isArray(tasks) ? tasks : [];

  // Transform members
  const workloadMembers: IWorkloadMember[] = safeMembers.map((member: any) => {
    // Use organization working settings
    const dailyHours = member.org_working_hours || 8;
    const workingDaysPerWeek = calculateWorkingDaysPerWeek(member.org_working_days);
    const weeklyCapacity = dailyHours * workingDaysPerWeek;

    return {
      id: member.project_member_id || member.team_member_id,
      name: member.name,
      email: member.email,
      avatar: member.avatar_url,
      role: member.role,
      teamId: member.team_member_id,
      dailyCapacity: dailyHours,
      weeklyCapacity: weeklyCapacity,
      expectedCapacity: weeklyCapacity, // Alias for compatibility with components
      currentWorkload: calculateMemberWorkload(member, safeTasks),
      utilizationPercentage: calculateUtilization(
        member,
        safeTasks,
        dailyHours,
        workingDaysPerWeek
      ),
      isOverallocated: false, // Will be calculated
      isUnderutilized: false, // Will be calculated
    };
  });

  // Update overallocation flags - use configurable thresholds
  workloadMembers.forEach(member => {
    member.isOverallocated = member.utilizationPercentage > 100;
    member.isUnderutilized = member.utilizationPercentage < 50; // This should ideally use Redux state alertThresholds.underutilization
  });

  // Transform tasks to allocations - get tasks from member data
  const allocations: ITaskAllocation[] = [];
  safeMembers.forEach((member: any) => {
    if (Array.isArray(member.tasks)) {
      member.tasks.forEach((task: any, index: number) => {
        if (task.start_date && task.end_date) {
          // Calculate hours based on entry type
          let hours = 4; // Default estimation
          if (task.entry_type === 'time_log' && task.logged_hours) {
            hours = parseFloat(task.logged_hours);
          }

          const taskName =
            task.entry_type === 'time_log'
              ? `${task.task_name || 'Task'} (${hours.toFixed(1)}h logged)`
              : task.task_name || `Task ${index + 1}`;

          // Parse dates properly handling timezone
          const startDateStr =
            typeof task.start_date === 'string'
              ? task.start_date.split('T')[0]
              : new Date(task.start_date).toISOString().split('T')[0];
          const endDateStr =
            typeof task.end_date === 'string'
              ? task.end_date.split('T')[0]
              : new Date(task.end_date).toISOString().split('T')[0];

          allocations.push({
            id: `${member.project_member_id || member.team_member_id}-task-${task.task_id || index}-${startDateStr}`,
            taskId: task.task_id || `task-${index}`,
            taskName: taskName,
            projectId: member.project_id || 'current-project',
            projectName: 'Current Project',
            memberId: member.project_member_id || member.team_member_id || member.user_id,
            memberName: member.name || 'Unknown',
            estimatedHours: hours,
            actualHours: task.entry_type === 'time_log' ? hours : 0,
            startDate: startDateStr,
            endDate: endDateStr,
            priority: task.priority_name || 'Medium',
            priorityColor: task.priority_color || '#1890ff',
            status: task.status_name || 'In Progress',
            statusColor: task.status_color || '#52c41a',
            completionPercentage: 0,
          });
        }
      });
    }
  });

  // Generate availability data using organization working days
  const availability: IMemberAvailability[] = [];
  workloadMembers.forEach(member => {
    // Get the member's original data to access working days settings
    const originalMember = safeMembers.find(
      m => (m.project_member_id || m.team_member_id) === member.id
    );
    const workingDays = originalMember?.org_working_days || {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
    };

    // Use a default of 8 hours for API service transformation
    // This will be overridden by the calendar component using filter settings
    const defaultDailyHours = 8;

    // Generate availability for the next 30 days
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

      // Map day of week to working days object
      const dayNames = [
        'sunday',
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
      ];
      const isWorkingDay = workingDays[dayNames[dayOfWeek]] || false;

      availability.push({
        memberId: member.id,
        date: dateStr,
        availableHours: isWorkingDay ? defaultDailyHours : 0,
        plannedHours: isWorkingDay ? Math.min(defaultDailyHours, member.currentWorkload / 30) : 0,
        actualHours: 0,
        isWorkingDay: isWorkingDay,
        isHoliday: false,
        isLeave: false,
      });
    }
  });

  return {
    projectId: safeMembers[0]?.project_id || 'unknown',
    projectName: 'Project',
    members: workloadMembers,
    allocations,
    availability,
    summary: {
      totalMembers: workloadMembers.length,
      totalTasks: safeTasks.length,
      totalEstimatedHours:
        Math.round(
          allocations.reduce((sum, alloc) => {
            // Only count estimated hours from planned tasks, not time logs
            // Time logs have actualHours > 0 and estimatedHours = actualHours
            if (alloc.actualHours > 0 && alloc.estimatedHours === alloc.actualHours) {
              // This is a time log entry, don't count as estimated work
              return sum;
            }
            return sum + alloc.estimatedHours;
          }, 0) * 10
        ) / 10,
      totalActualHours:
        Math.round(allocations.reduce((sum, alloc) => sum + (alloc.actualHours || 0), 0) * 10) / 10,
      averageUtilization:
        workloadMembers.reduce((sum, member) => sum + member.utilizationPercentage, 0) /
        (workloadMembers.length || 1),
      overallocatedMembers: workloadMembers.filter(m => m.isOverallocated).length,
      underutilizedMembers: workloadMembers.filter(m => m.isUnderutilized).length,
      criticalTasks: allocations.filter(alloc => alloc.priority === 'High').length,
    },
  };
};

const calculateMemberWorkload = (member: any, tasks: any[]): number => {
  // Calculate workload based on actual logged time from logs_date_union
  if (!member) return 0;

  // Method 1: Use actual logged time if available (preferred method)
  if (member.logs_date_union && member.logs_date_union.total_time_spent_seconds) {
    // Convert seconds to hours
    const totalSeconds = Number(member.logs_date_union.total_time_spent_seconds);
    if (isNaN(totalSeconds) || !isFinite(totalSeconds)) return 0;
    const totalHours = totalSeconds / 3600;
    return Math.round(totalHours * 100) / 100; // Round to 2 decimal places
  }

  // Method 2: Fallback to task assignments if no logged time
  if (!Array.isArray(tasks)) return 0;

  let totalHours = 0;
  tasks.forEach(task => {
    if (task.assignees && Array.isArray(task.assignees)) {
      const isAssigned = task.assignees.some(
        (assignee: any) =>
          assignee.team_member_id === member.team_member_id ||
          assignee.project_member_id === member.project_member_id
      );
      if (isAssigned && task.total_minutes) {
        // Convert minutes to hours
        totalHours += task.total_minutes / 60;
      }
    }
  });

  return Math.round(totalHours);
};

const calculateUtilization = (
  member: any,
  tasks: any[],
  dailyHours?: number,
  workingDaysPerWeek?: number
): number => {
  if (!member) return 0;
  const workload = calculateMemberWorkload(member, tasks);

  // Use organization working settings if provided, otherwise use member/project settings or defaults
  const hoursPerDay = dailyHours || member.org_working_hours || member.hours_per_day || 8;
  const daysPerWeek = workingDaysPerWeek || calculateWorkingDaysPerWeek(member.org_working_days);
  const weeklyCapacity = hoursPerDay * daysPerWeek;

  if (weeklyCapacity === 0) return 0;
  return Math.round((workload / weeklyCapacity) * 100);
};

// Helper function to get member's allocated capacity from project_member_allocations
const getMemberCapacityFromAllocations = (member: any, allocations: any[] = []): number => {
  if (!Array.isArray(allocations)) {
    // Use organization working settings if available
    const dailyHours = member.org_working_hours || 8;
    const workingDaysPerWeek = calculateWorkingDaysPerWeek(member.org_working_days);
    return dailyHours * workingDaysPerWeek;
  }

  const memberAllocation = allocations.find(
    alloc => alloc.team_member_id === member.team_member_id
  );

  if (memberAllocation && memberAllocation.seconds_per_day) {
    // Convert seconds per day to hours per week using organization working days
    const hoursPerDay = memberAllocation.seconds_per_day / 3600;
    const workingDaysPerWeek = calculateWorkingDaysPerWeek(member.org_working_days);
    return hoursPerDay * workingDaysPerWeek;
  }

  // Fallback to organization settings or default
  const dailyHours = member.org_working_hours || 8;
  const workingDaysPerWeek = calculateWorkingDaysPerWeek(member.org_working_days);
  return dailyHours * workingDaysPerWeek;
};

const projectWorkloadApi = createApi({
  reducerPath: 'projectWorkloadApi',
  baseQuery: fetchBaseQuery({
    baseUrl: `${config.apiUrl}${API_BASE_URL}`,
    prepareHeaders: async headers => {
      let token = getCsrfToken();
      if (!token) {
        try {
          token = await ensureCsrfToken();
        } catch (error) {
          console.error('[CSRF] Failed to refresh CSRF token:', error);
        }
      }
      if (token) {
        headers.set('X-CSRF-Token', token);
      }
      headers.set('Content-Type', 'application/json');
      return headers;
    },
    credentials: 'include',
  }),
  tagTypes: ['ProjectWorkload', 'MemberCapacity', 'TaskAllocations', 'WorkloadAnalytics'],
  endpoints: builder => ({
    getWorkloadChartDates: builder.query<
      any,
      { projectId: string; timeZone?: string; startDate?: string; endDate?: string }
    >({
      query: ({ projectId, timeZone = 'UTC', startDate, endDate }) => ({
        url: `/workload-gannt/chart-dates/${projectId}`,
        method: 'GET',
        params: { timeZone, start_date: startDate, end_date: endDate },
      }),
      providesTags: (result, error, { projectId, startDate, endDate }) => [
        { type: 'ProjectWorkload', id: `chart-dates-${projectId}-${startDate}-${endDate}` },
      ],
      keepUnusedDataFor: 0, // No caching - always fetch fresh data
    }),

    getWorkloadMembers: builder.query<
      any,
      { projectId: string; expandedMembers?: string[]; startDate?: string; endDate?: string }
    >({
      query: ({ projectId, expandedMembers = [], startDate, endDate }) => ({
        url: `/workload-gannt/workload-members/${projectId}`,
        method: 'GET',
        params: {
          expanded_members: expandedMembers,
          start_date: startDate,
          end_date: endDate,
        },
      }),
      providesTags: (result, error, { projectId, startDate, endDate }) => [
        { type: 'ProjectWorkload', id: `members-${projectId}-${startDate}-${endDate}` },
      ],
      keepUnusedDataFor: 0, // No caching - always fetch fresh data
    }),

    getWorkloadTasksByMember: builder.query<any, { projectId: string; params?: any }>({
      query: ({ projectId, params = {} }) => ({
        url: `/workload-gannt/workload-tasks-by-member/${projectId}`,
        method: 'GET',
        params,
      }),
      providesTags: (result, error, { projectId, params }) => [
        {
          type: 'TaskAllocations',
          id: `tasks-${projectId}-${params?.startDate}-${params?.endDate}`,
        },
      ],
      keepUnusedDataFor: 0, // No caching - always fetch fresh data
    }),

    getMemberOverview: builder.query<any, { projectId: string; teamMemberId: string }>({
      query: ({ projectId, teamMemberId }) => ({
        url: `/workload-gannt/workload-overview-by-member/${projectId}`,
        method: 'GET',
        params: { team_member_id: teamMemberId },
      }),
      providesTags: (result, error, { projectId, teamMemberId }) => [
        { type: 'WorkloadAnalytics', id: `overview-${projectId}-${teamMemberId}` },
      ],
      keepUnusedDataFor: 10 * 60, // 10 minutes cache
    }),

    // Derived endpoint for consolidated workload data
    getProjectWorkload: builder.query<
      IWorkloadData,
      { projectId: string; startDate?: string; endDate?: string }
    >({
      queryFn: async ({ projectId, startDate, endDate }, { dispatch, getState }) => {
        try {
          console.log('getProjectWorkload called with:', { projectId, startDate, endDate });

          // Use RTK Query's built-in query dispatching with proper error handling
          const chartDatesPromise = dispatch(
            projectWorkloadApi.endpoints.getWorkloadChartDates.initiate({
              projectId,
              startDate,
              endDate,
            })
          );
          const membersPromise = dispatch(
            projectWorkloadApi.endpoints.getWorkloadMembers.initiate({
              projectId,
              startDate,
              endDate,
            })
          );
          const tasksPromise = dispatch(
            projectWorkloadApi.endpoints.getWorkloadTasksByMember.initiate({
              projectId,
              params: { startDate, endDate },
            })
          );

          // Wait for all promises to resolve
          const [chartDatesResult, membersResult, tasksResult] = await Promise.all([
            chartDatesPromise,
            membersPromise,
            tasksPromise,
          ]);

          console.log('API Results:', {
            chartDates: chartDatesResult,
            members: membersResult,
            tasks: tasksResult,
          });

          // Check for errors in any of the requests
          if (chartDatesResult.error) {
            console.error('Chart dates API error:', chartDatesResult.error);
            return { error: chartDatesResult.error };
          }
          if (membersResult.error) {
            console.error('Members API error:', membersResult.error);
            return { error: membersResult.error };
          }
          if (tasksResult.error) {
            console.error('Tasks API error:', tasksResult.error);
            return { error: tasksResult.error };
          }

          // Validate that we have data
          if (!chartDatesResult.data || !membersResult.data || !tasksResult.data) {
            const error = {
              status: 'FETCH_ERROR',
              error: 'One or more API calls returned no data',
            };
            console.error('Missing data error:', error);
            return { error };
          }

          // Validate and prepare data for transformation
          const transformData = {
            chartDates: chartDatesResult.data?.body || null,
            members: membersResult.data?.body || [],
            tasks: tasksResult.data?.body || [],
          };

          console.log('Transform data:', transformData);

          // Transform data to match our interface
          const workloadData = transformToWorkloadData(transformData);

          console.log('Transformed workload data:', workloadData);

          return { data: workloadData };
        } catch (error) {
          console.error('Error in getProjectWorkload:', error);
          return {
            error: {
              status: 'FETCH_ERROR',
              error: error instanceof Error ? error.message : 'Unknown error occurred',
            },
          };
        }
      },
      providesTags: (result, error, { projectId, startDate, endDate }) => [
        { type: 'ProjectWorkload', id: `${projectId}-${startDate}-${endDate}` },
        { type: 'ProjectWorkload', id: 'LIST' },
      ],
      // No caching - always fetch fresh data when date range changes
      keepUnusedDataFor: 0,
    }),
  }),
});

// Utility function to format time in user-friendly format
export const formatTime = (hours: number): string => {
  // Handle NaN, undefined, null, or invalid values
  if (!hours || isNaN(hours) || !isFinite(hours)) return '0h';

  if (hours === 0) return '0h';

  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours % 1) * 60);

  if (wholeHours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${wholeHours}h`;
  }

  return `${wholeHours}h ${minutes}m`;
};

export default projectWorkloadApi;

export const {
  useGetProjectWorkloadQuery,
  useGetWorkloadChartDatesQuery,
  useGetWorkloadMembersQuery,
  useGetWorkloadTasksByMemberQuery,
  useGetMemberOverviewQuery,
} = projectWorkloadApi;
