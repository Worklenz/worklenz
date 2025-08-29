import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from '@/shared/constants';
import {
  IWorkloadData,
  IWorkloadMember,
  ITaskAllocation,
  IMemberAvailability,
} from '@/types/workload/workload.types';
import { getCsrfToken, refreshCsrfToken } from '../api-client';
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

  // Transform tasks to allocations
  const allocations: ITaskAllocation[] = [];
  if (Array.isArray(safeTasks)) {
    safeTasks.forEach((task: any) => {
      if (task.assignees && Array.isArray(task.assignees)) {
        task.assignees.forEach((assignee: any) => {
          allocations.push({
            id: `${task.id}-${assignee.id}`,
            taskId: task.id,
            taskName: task.name,
            projectId: task.project_id,
            projectName: task.project_name || 'Project',
            memberId: assignee.id,
            memberName: assignee.name,
            estimatedHours: task.total_minutes ? Math.round(task.total_minutes / 60) : 0,
            actualHours: 0, // This would need to come from time logs
            startDate: task.start_date || new Date().toISOString().split('T')[0],
            endDate: task.end_date || new Date().toISOString().split('T')[0],
            priority: task.priority_value || 'Medium',
            priorityColor: task.priority_color,
            status: task.status_name || 'To Do',
            statusColor: task.status_color,
            completionPercentage: task.complete_ratio || 0,
          });
        });
      }
    });
  }

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
        availableHours: isWorkingDay ? member.dailyCapacity : 0,
        plannedHours: isWorkingDay
          ? Math.min(member.dailyCapacity, member.currentWorkload / 30)
          : 0,
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
      totalEstimatedHours: allocations.reduce((sum, alloc) => sum + alloc.estimatedHours, 0),
      totalActualHours: allocations.reduce((sum, alloc) => sum + (alloc.actualHours || 0), 0),
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
  // Calculate workload based on database schema
  if (!member || !Array.isArray(tasks)) return 0;

  let totalHours = 0;

  // Method 1: From task assignments (tasks_assignees table)
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
        token = await refreshCsrfToken();
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
    getWorkloadChartDates: builder.query<any, { projectId: string; timeZone?: string }>({
      query: ({ projectId, timeZone = 'UTC' }) => ({
        url: `/workload-gannt/chart-dates/${projectId}`,
        method: 'GET',
        params: { timeZone },
      }),
      providesTags: (result, error, { projectId }) => [
        { type: 'ProjectWorkload', id: `chart-dates-${projectId}` },
      ],
      keepUnusedDataFor: 10 * 60, // 10 minutes cache
    }),

    getWorkloadMembers: builder.query<any, { projectId: string; expandedMembers?: string[] }>({
      query: ({ projectId, expandedMembers = [] }) => ({
        url: `/workload-gannt/workload-members/${projectId}`,
        method: 'GET',
        params: { expanded_members: expandedMembers },
      }),
      providesTags: (result, error, { projectId }) => [
        { type: 'ProjectWorkload', id: `members-${projectId}` },
      ],
      keepUnusedDataFor: 10 * 60, // 10 minutes cache
    }),

    getWorkloadTasksByMember: builder.query<any, { projectId: string; params?: any }>({
      query: ({ projectId, params = {} }) => ({
        url: `/workload-gannt/workload-tasks-by-member/${projectId}`,
        method: 'GET',
        params,
      }),
      providesTags: (result, error, { projectId }) => [
        { type: 'TaskAllocations', id: `tasks-${projectId}` },
      ],
      keepUnusedDataFor: 5 * 60, // 5 minutes cache (tasks change more frequently)
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
      queryFn: async ({ projectId, startDate, endDate }, { dispatch }) => {
        try {
          console.log('Fetching workload data for project:', projectId);

          // Fetch all required data in parallel
          const [chartDatesResult, membersResult, tasksResult] = await Promise.all([
            dispatch(projectWorkloadApi.endpoints.getWorkloadChartDates.initiate({ projectId })),
            dispatch(projectWorkloadApi.endpoints.getWorkloadMembers.initiate({ projectId })),
            dispatch(
              projectWorkloadApi.endpoints.getWorkloadTasksByMember.initiate({
                projectId,
                params: {
                  startDate,
                  endDate,
                },
              })
            ),
          ]);

          console.log('API Results:', {
            chartDates: chartDatesResult,
            members: membersResult,
            tasks: tasksResult,
          });

          if (chartDatesResult.error || membersResult.error || tasksResult.error) {
            const error = chartDatesResult.error || membersResult.error || tasksResult.error;
            console.error('API Error:', error);
            return { error };
          }

          // Validate and prepare data for transformation
          const transformData = {
            chartDates: chartDatesResult.data?.body || null,
            members: membersResult.data?.body || [],
            tasks: tasksResult.data?.body || [],
          };

          console.log('Data for transformation:', transformData);

          // Transform data to match our interface
          const workloadData = transformToWorkloadData(transformData);

          console.log('Transformed workload data:', workloadData);
          return { data: workloadData };
        } catch (error) {
          console.error('Error in getProjectWorkload:', error);
          return { error: { status: 'FETCH_ERROR', error: error.message || 'Unknown error' } };
        }
      },
      providesTags: (result, error, { projectId }) => [
        { type: 'ProjectWorkload', id: projectId },
        { type: 'ProjectWorkload', id: 'LIST' },
      ],
      // Keep cached data for 10 minutes to improve performance
      keepUnusedDataFor: 10 * 60,
    }),
  }),
});

export default projectWorkloadApi;

export const {
  useGetProjectWorkloadQuery,
  useGetWorkloadChartDatesQuery,
  useGetWorkloadMembersQuery,
  useGetWorkloadTasksByMemberQuery,
  useGetMemberOverviewQuery,
} = projectWorkloadApi;
