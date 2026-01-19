import { useMemo, useEffect } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useTranslation } from 'react-i18next';
import { useFetchScheduleMembersQuery, useFetchMemberScheduleSummaryQuery } from '@/api/schedule/scheduleApi';
import { Empty, Spin } from '@/shared/antd-imports';
import dayjs from 'dayjs';
import GroupByFilterDropdown from '@/pages/projects/project-view-1/taskList/taskListFilters/GroupByFilterDropdown';
import TaskListV2Section from '@/components/task-list-v2/TaskListV2Table';
import { setMembers } from '@/features/tasks/tasks.slice';

const WithStartAndEndDates = () => {
  const { t } = useTranslation('schedule');
  const dispatch = useAppDispatch();
  
  // Get selected member and date from Redux
  const selectedMemberId = useAppSelector(state => state.schedule?.selectedMemberId);
  const selectedDate = useAppSelector(state => state.schedule?.selectedDate);
  
  // Fetch all team members to get member details
  const { data: teamDataResponse } = useFetchScheduleMembersQuery();
  const teamData = teamDataResponse?.body || [];
  
  // Calculate date range (e.g., selected date ± 30 days)
  const dateRange = useMemo(() => {
    if (!selectedDate) {
      return {
        startDate: dayjs().subtract(30, 'days').format('YYYY-MM-DD'),
        endDate: dayjs().add(30, 'days').format('YYYY-MM-DD'),
      };
    }
    return {
      startDate: dayjs(selectedDate).subtract(30, 'days').format('YYYY-MM-DD'),
      endDate: dayjs(selectedDate).add(30, 'days').format('YYYY-MM-DD'),
    };
  }, [selectedDate]);
  
  // Fetch member schedule summary
  const {
    data: summaryResponse,
    isLoading: summaryLoading,
  } = useFetchMemberScheduleSummaryQuery(
    {
      memberId: selectedMemberId || '',
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
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
  
  // Debug state
  useEffect(() => {
    console.log('📋 WithStartAndEndDates state:', { selectedMemberId, selectedDate, summary });
  }, [selectedMemberId, selectedDate, summary]);
  
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
                <span>{t('allocatedTime')}</span>
                <span>{summary.allocatedHours.toFixed(1)} {t('hours')}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{t('totalLogged')}</span>
                <span>{summary.totalLogged.toFixed(1)} {t('hours')}</span>
              </div>
            </div>
            <div style={{ width: '50%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{t('loggedBillable')}</span>
                <span>{summary.loggedBillable.toFixed(1)} {t('hours')}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{t('loggedNonBillable')}</span>
                <span>{summary.loggedNonBillable.toFixed(1)} {t('hours')}</span>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Group By Filter */}
      <div>
        <GroupByFilterDropdown position="list" />
      </div>
      
      {/* Task List */}
      <div style={{ height: '500px', overflow: 'hidden' }}>
        <TaskListV2Section />
      </div>
    </div>
  );
};

export default WithStartAndEndDates;
