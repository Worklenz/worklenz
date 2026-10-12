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

// The backend embeds each member's tasks as a UNION of one row per assigned
// task plus one row per distinct day time was logged against that task, so a
// task logged on 3 different days produces 4 raw entries for the same task.
// This collapses that back down to one entry per task_id, preferring the
// 'task' row (has the real assignment dates) over a 'time_log' row.
export const normalizeMemberTasks = (rawTasks: any, member: any): ITaskAllocation[] => {
  if (!Array.isArray(rawTasks)) return [];

  const memberId = member?.project_member_id || member?.team_member_id || member?.user_id || '';
  const grouped = new Map<string, any[]>();

  rawTasks.forEach((task: any, index: number) => {
    const taskId = task.task_id || `task-${index}`;
    const group = grouped.get(taskId);
    if (group) group.push(task);
    else grouped.set(taskId, [task]);
  });

  const result: ITaskAllocation[] = [];
  grouped.forEach((rows, taskId) => {
    // Use the real assignment row for name/dates/status/priority when present,
    // otherwise the first logged-time row. Sum hours across every logged-time
    // row for this task instead of keeping only one — a task logged on
    // several days must not lose all but one day's hours.
    const base = rows.find(r => r.entry_type === 'task') || rows[0];
    const actualHours = rows
      .filter(r => r.entry_type === 'time_log')
      .reduce((sum, r) => sum + (r.logged_hours ? parseFloat(r.logged_hours) : 0), 0);

    result.push({
      id: `${memberId}-task-${taskId}`,
      taskId,
      taskName: base.task_name || `Task ${taskId}`,
      projectId: member?.project_id || 'current-project',
      projectName: 'Current Project',
      memberId,
      memberName: member?.name || '',
      estimatedHours: actualHours || 4,
      actualHours,
      startDate: base.start_date ? String(base.start_date).split('T')[0] : '',
      endDate: base.end_date ? String(base.end_date).split('T')[0] : '',
      priority: base.priority_name || 'Medium',
      priorityColor: base.priority_color || '#1890ff',
      status: base.status_name || 'In Progress',
      statusColor: base.status_color || '#52c41a',
      completionPercentage: 0,
      entryType: base.entry_type,
    });
  });

  return result;
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
      tasks: normalizeMemberTasks(member.tasks, member),
      utilizationPercentage: calculateUtilization(
        member,
        safeTasks,
        dailyHours,
        workingDaysPerWeek
      ),
      isOverallocated: false, // Will be calculated
      isUnderutilized: false, // Will be calculated
      hasAnyAssignment: member.has_any_assignment ?? true,
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
            if ((alloc.actualHours ?? 0) > 0 && alloc.estimatedHours === alloc.actualHours) {
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

    getProjectWorkload: builder.query<
      IWorkloadData,
      { projectId: string; startDate?: string; endDate?: string }
    >({
      queryFn: async ({ projectId, startDate, endDate }, _api, _extraOptions, baseQuery) => {
        try {
          const [chartDatesResult, membersResult, tasksResult] = await Promise.all([
            baseQuery({
              url: `/workload-gannt/chart-dates/${projectId}`,
              method: 'GET',
              params: { timeZone: 'UTC', start_date: startDate, end_date: endDate },
            }),
            baseQuery({
              url: `/workload-gannt/workload-members/${projectId}`,
              method: 'GET',
              params: {
                start_date: startDate,
                end_date: endDate,
              },
            }),
            baseQuery({
              url: `/workload-gannt/workload-tasks-by-member/${projectId}`,
              method: 'GET',
              params: { startDate, endDate },
            }),
          ]);

          if (chartDatesResult.error) {
            return { error: chartDatesResult.error };
          }
          if (membersResult.error) {
            return { error: membersResult.error };
          }
          if (tasksResult.error) {
            return { error: tasksResult.error };
          }

          const chartData = chartDatesResult.data as { body?: unknown } | undefined;
          const memberData = membersResult.data as { body?: unknown[] } | undefined;
          const taskData = tasksResult.data as { body?: unknown[] } | undefined;

          if (!chartData || !memberData || !taskData) {
            return {
              error: {
                status: 'FETCH_ERROR',
                error: 'One or more API calls returned no data',
              },
            };
          }

          const transformData = {
            chartDates: chartData.body ?? null,
            members: memberData.body ?? [],
            tasks: taskData.body ?? [],
          };

          const workloadData = transformToWorkloadData(transformData);
          return { data: workloadData };
        } catch (error: unknown) {
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
