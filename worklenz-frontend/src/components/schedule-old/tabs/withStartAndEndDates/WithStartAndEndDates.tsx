import { useMemo, useEffect, useState } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useTranslation } from 'react-i18next';
import {
  useFetchScheduleMembersQuery,
  useFetchMemberScheduleSummaryQuery,
  useFetchProjectMemberTasksQuery,
} from '@/api/schedule/scheduleApi';
import { Empty, Spin } from '@/shared/antd-imports';
import dayjs from 'dayjs';
import GroupByFilterDropdown from '@/components/project-task-filters/filter-dropdowns/group-by-filter-dropdown';
import { setMembers } from '@/features/tasks/tasks.slice';
import ScheduleTaskGroupHeader from '@/components/schedule/ScheduleTaskGroupHeader';
import ScheduleTaskRow from '@/components/schedule/ScheduleTaskRow';
import ScheduleTaskListHeader from '@/components/schedule/ScheduleTaskListHeader';

const WithStartAndEndDates = () => {
  const { t } = useTranslation('schedule');
  const dispatch = useAppDispatch();

  // Get selected member, project, segment data, and date range from Redux
  const selectedMemberId = useAppSelector(state => state.schedule?.selectedMemberId);
  const selectedProjectId = useAppSelector(state => state.schedule?.selectedProjectId);
  const selectedSegmentData = useAppSelector(state => state.schedule?.selectedSegmentData);
  const selectedDateRange = useAppSelector(state => state.schedule?.selectedDateRange);

  // Get groupBy from Redux store
  const groupBy = useAppSelector(state => state.groupByFilterDropdownReducer?.groupBy || 'status');

  // Fetch all team members to get member details
  const { data: teamDataResponse } = useFetchScheduleMembersQuery();
  const teamData = teamDataResponse?.body || [];

  // Calculate date range from selected timeline or default
  const dateRange = useMemo(() => {
    if (selectedDateRange?.start && selectedDateRange?.end) {
      return {
        startDate: selectedDateRange.start,
        endDate: selectedDateRange.end,
      };
    }
    // Fallback to ±30 days from today
    return {
      startDate: dayjs().subtract(30, 'days').format('YYYY-MM-DD'),
      endDate: dayjs().add(30, 'days').format('YYYY-MM-DD'),
    };
  }, [selectedDateRange]);

  // Fetch member schedule summary
  const { data: summaryResponse, isLoading: summaryLoading } = useFetchMemberScheduleSummaryQuery(
    {
      memberId: selectedMemberId || '',
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      projectId: selectedProjectId || undefined, // Include projectId to filter by project
    },
    {
      skip: !selectedMemberId,
    }
  );

  const summary = summaryResponse?.body || {
    allocatedHours: 0,
    totalLogged: 0,
    loggedBillable: 0,
    loggedNonBillable: 0,
  };

  // Fetch project-specific tasks if project is selected
  const {
    data: projectTasksResponse,
    isLoading: projectTasksLoading,
    error: projectTasksError,
  } = useFetchProjectMemberTasksQuery(
    {
      projectId: selectedProjectId || '',
      memberId: selectedMemberId || '',
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      group: groupBy, // Pass the groupBy parameter
    },
    {
      skip: !selectedProjectId || !selectedMemberId,
    }
  );

  const projectTasks = useMemo(() => {
    if (!projectTasksResponse?.body) return [];

    // Handle new structured response format
    if (projectTasksResponse.body.groups && Array.isArray(projectTasksResponse.body.groups)) {
      return projectTasksResponse.body.groups;
    }

    // Fallback to old format if needed
    if (Array.isArray(projectTasksResponse.body)) {
      return projectTasksResponse.body;
    }

    return [];
  }, [projectTasksResponse]);

  // State for collapsed groups
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  // Fetch statuses and priorities when project is selected
  useEffect(() => {
    if (selectedProjectId) {
      // Fetch statuses for the selected project
      import('@/features/taskAttributes/taskStatusSlice').then(({ fetchStatuses }) => {
        dispatch(fetchStatuses(selectedProjectId));
      });

      // Fetch priorities (they're global, not project-specific)
      import('@/features/taskAttributes/taskPrioritySlice').then(({ fetchPriorities }) => {
        dispatch(fetchPriorities());
      });
    }
  }, [selectedProjectId, dispatch]);

  // Set filter to show only selected member's tasks
  useEffect(() => {
    if (selectedMemberId && teamData.length > 0) {
      // Find the selected member in team data
      const selectedMember = teamData.find(
        (member: any) =>
          member.team_member_id === selectedMemberId || member.id === selectedMemberId
      );

      if (selectedMember) {
        // Filter tasks by selected member
        const memberFilter = [
          {
            ...selectedMember,
            selected: true,
          },
        ];
        dispatch(setMembers(memberFilter));
      }
    }

    // Cleanup: reset filters when component unmounts
    return () => {
      dispatch(setMembers([]));
    };
  }, [selectedMemberId, teamData, dispatch]);

  if (!selectedMemberId) {
    return (
      <div style={{ padding: '40px' }}>
        <Empty
          description={t('selectMemberToViewTasks') || 'Select a member to view their tasks'}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Summary Card */}
      <div
        style={{
          display: 'flex',
          gap: '5px',
          flexDirection: 'column',
          border: '1px solid rgba(0, 0, 0, 0.21)',
          padding: '20px',
          borderRadius: '15px',
        }}
      >
        <span style={{ fontSize: '24px', fontWeight: 'bold', color: 'rgba(112, 113, 114, 1)' }}>
          {dateRange.startDate} - {dateRange.endDate}
        </span>

        {summaryLoading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Spin />
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              gap: '200px',
              color: 'rgba(121, 119, 119, 1)',
            }}
          >
            <div style={{ width: '50%' }}>
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <span>{t('allocatedTime', { defaultValue: 'Allocated Time' })}</span>
                <span>
                  {summary.allocatedHours.toFixed(1)} {t('hours', { defaultValue: 'hours' })}
                </span>
              </div>
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <span>{t('totalLogged', { defaultValue: 'Total Logged' })}</span>
                <span>
                  {summary.totalLogged.toFixed(1)} {t('hours', { defaultValue: 'hours' })}
                </span>
              </div>
            </div>
            <div style={{ width: '50%' }}>
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <span>{t('loggedBillable', { defaultValue: 'Logged Billable' })}</span>
                <span>
                  {summary.loggedBillable.toFixed(1)} {t('hours', { defaultValue: 'hours' })}
                </span>
              </div>
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <span>{t('loggedNonBillable', { defaultValue: 'Logged Non-Billable' })}</span>
                <span>
                  {summary.loggedNonBillable.toFixed(1)} {t('hours', { defaultValue: 'hours' })}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Project-specific tasks or all member tasks */}
      {selectedProjectId ? (
        <>
          {/* Show group by filter for project tasks */}
          <div style={{ marginBottom: '16px' }}>
            <GroupByFilterDropdown />
          </div>

          {projectTasksLoading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Spin size="large" />
            </div>
          ) : projectTasks.length > 0 ? (
            <div
              style={{
                border: '1px solid rgba(0, 0, 0, 0.1)',
                borderRadius: '8px',
                overflow: 'hidden',
                maxHeight: '600px',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Sticky Header */}
              <ScheduleTaskListHeader />

              {/* Scrollable Content */}
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {/* Display project tasks grouped */}
                {projectTasks.map((group: any) => {
                  const isCollapsed = collapsedGroups.has(group.id);

                  return (
                    <div key={group.id}>
                      <ScheduleTaskGroupHeader
                        group={{
                          id: group.id,
                          name: group.name,
                          tasks: group.tasks || [],
                          color_code: group.color_code,
                        }}
                        isCollapsed={isCollapsed}
                        onToggle={() => toggleGroupCollapse(group.id)}
                      />

                      {!isCollapsed && (
                        <>
                          {group.tasks && group.tasks.length > 0 ? (
                            group.tasks.map((task: any) => (
                              <ScheduleTaskRow
                                key={task.id}
                                task={{
                                  id: task.id,
                                  name: task.name,
                                  task_key: task.task_key,
                                  status: task.status,
                                  status_color: task.status_color,
                                  labels: task.labels,
                                  total_minutes: task.total_minutes,
                                  total_minutes_spent: task.total_minutes_spent,
                                  phase_name: task.phase_name,
                                  phase_color: task.phase_color,
                                  priority: task.priority,
                                  priority_color: task.priority_color,
                                  start_date: task.start_date,
                                  end_date: task.end_date,
                                  progress: task.progress,
                                  assignees: task.assignees,
                                }}
                                onClick={() => {
                                  // Handle task click - could open task drawer
                                }}
                              />
                            ))
                          ) : (
                            <div
                              style={{
                                padding: '24px',
                                textAlign: 'center',
                                color: '#999',
                                fontStyle: 'italic',
                              }}
                            >
                              {t('noTasksInGroup', { defaultValue: 'No tasks in this group' })}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <Empty
              description={t('noTasksInDateRange', {
                defaultValue: 'No tasks found in this date range',
              })}
            />
          )}
        </>
      ) : (
        <div style={{ padding: '40px' }}>
          <Empty
            description={t('selectProjectToViewTasks', {
              defaultValue: 'Select a project to view tasks',
            })}
          />
        </div>
      )}
    </div>
  );
};

export default WithStartAndEndDates;
