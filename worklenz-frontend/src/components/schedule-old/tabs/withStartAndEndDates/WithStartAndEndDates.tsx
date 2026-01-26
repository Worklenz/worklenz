import { useMemo, useEffect } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useTranslation } from 'react-i18next';
import { useFetchScheduleMembersQuery, useFetchMemberScheduleSummaryQuery, useFetchProjectMemberTasksQuery } from '@/api/schedule/scheduleApi';
import { Empty, Spin } from '@/shared/antd-imports';
import dayjs from 'dayjs';
import GroupByFilterDropdown from '@/pages/projects/project-view-1/taskList/taskListFilters/GroupByFilterDropdown';
import { setMembers } from '@/features/tasks/tasks.slice';

const WithStartAndEndDates = () => {
  const { t } = useTranslation('schedule');
  const dispatch = useAppDispatch();
  
  // Get selected member, project, and date range from Redux
  const selectedMemberId = useAppSelector(state => state.schedule?.selectedMemberId);
  const selectedProjectId = useAppSelector(state => state.schedule?.selectedProjectId);
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
  const {
    data: summaryResponse,
    isLoading: summaryLoading,
  } = useFetchMemberScheduleSummaryQuery(
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

  // Debug project tasks
  useEffect(() => {
    if (selectedProjectId) {
      console.log('🔍 Project Tasks Debug:', {
        selectedProjectId,
        selectedMemberId,
        dateRange,
        projectTasks,
        projectTasksLoading,
        projectTasksError,
      });
    }
  }, [selectedProjectId, selectedMemberId, dateRange, projectTasks, projectTasksLoading, projectTasksError]);
  
  // Debug state
  useEffect(() => {
    console.log('📋 WithStartAndEndDates state:', { 
      selectedMemberId, 
      selectedProjectId, 
      selectedDateRange,
      dateRange,
      summary,
      projectTasks: projectTasks.length,
      hasProjectSelected: !!selectedProjectId,
    });
  }, [selectedMemberId, selectedProjectId, selectedDateRange, dateRange, summary, projectTasks]);
  
  // Set filter to show only selected member's tasks
  useEffect(() => {
    if (selectedMemberId && teamData.length > 0) {
      // Find the selected member in team data
      const selectedMember = teamData.find(
        (member: any) => member.team_member_id === selectedMemberId || member.id === selectedMemberId
      );
      
      if (selectedMember) {
        // Filter tasks by selected member
        const memberFilter = [{
          ...selectedMember,
          selected: true
        }];
        dispatch(setMembers(memberFilter));
        console.log('🔍 Filtering tasks for member:', selectedMember.name);
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{t('allocatedTime', { defaultValue: 'Allocated Time' })}</span>
                <span>{summary.allocatedHours.toFixed(1)} {t('hours', { defaultValue: 'hours' })}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{t('totalLogged', { defaultValue: 'Total Logged' })}</span>
                <span>{summary.totalLogged.toFixed(1)} {t('hours', { defaultValue: 'hours' })}</span>
              </div>
            </div>
            <div style={{ width: '50%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{t('loggedBillable', { defaultValue: 'Logged Billable' })}</span>
                <span>{summary.loggedBillable.toFixed(1)} {t('hours', { defaultValue: 'hours' })}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{t('loggedNonBillable', { defaultValue: 'Logged Non-Billable' })}</span>
                <span>{summary.loggedNonBillable.toFixed(1)} {t('hours', { defaultValue: 'hours' })}</span>
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
            <GroupByFilterDropdown position="list" />
          </div>

          {projectTasksLoading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Spin size="large" />
            </div>
          ) : projectTasks.length > 0 ? (
            <div style={{ 
              border: '1px solid rgba(0, 0, 0, 0.1)', 
              borderRadius: '8px',
              padding: '16px',
              maxHeight: '500px',
              overflow: 'auto'
            }}>
              {/* Display project tasks grouped */}
              {projectTasks.map((group: any) => (
                <div key={group.id} style={{ marginBottom: '24px' }}>
                  <div style={{ 
                    fontSize: '16px', 
                    fontWeight: 'bold', 
                    marginBottom: '12px',
                    padding: '8px',
                    backgroundColor: `${group.color_code}20`,
                    borderLeft: `4px solid ${group.color_code}`,
                    borderRadius: '4px'
                  }}>
                    {group.name} ({group.tasks?.length || 0})
                  </div>
                  {group.tasks && group.tasks.length > 0 ? (
                    <div style={{ paddingLeft: '16px' }}>
                      {group.tasks.map((task: any) => (
                        <div 
                          key={task.id} 
                          style={{ 
                            padding: '12px',
                            marginBottom: '8px',
                            border: '1px solid rgba(0, 0, 0, 0.1)',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(255, 255, 255, 0.5)',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          className="hover:shadow-md"
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 500 }}>{task.name}</span>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              {task.start_date && task.end_date && (
                                <span style={{ fontSize: '12px', color: '#666' }}>
                                  {task.start_date} → {task.end_date}
                                </span>
                              )}
                              {task.status_color && (
                                <span style={{ 
                                  fontSize: '11px', 
                                  padding: '2px 8px', 
                                  borderRadius: '4px',
                                  backgroundColor: task.status_color || '#ccc',
                                  color: '#fff'
                                }}>
                                  {task.status}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ 
                      paddingLeft: '16px', 
                      color: '#999', 
                      fontStyle: 'italic',
                      padding: '12px'
                    }}>
                      {t('noTasksInGroup', { defaultValue: 'No tasks in this group' })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Empty description={t('noTasksInDateRange', { defaultValue: 'No tasks found in this date range' })} />
          )}
        </>
      ) : (
        <div style={{ padding: '40px' }}>
          <Empty
            description={t('selectProjectToViewTasks', { defaultValue: 'Select a project to view tasks' })}
          />
        </div>
      )}
    </div>
  );
};

export default WithStartAndEndDates;
