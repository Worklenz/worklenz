import { Avatar, Drawer, Tabs, TabsProps } from '@/shared/antd-imports';
import React from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleScheduleDrawer } from './scheduleSliceRTK';
import WithStartAndEndDates from '../../components/schedule-old/tabs/withStartAndEndDates/WithStartAndEndDates';
import WorkloadManagement from './WorkloadManagement';
import { useTranslation } from 'react-i18next';
import { useFetchScheduleMembersQuery } from '@/api/schedule/scheduleApi';
import CustomAvatar from '@/components/CustomAvatar';
import { Member } from '@/types/schedule/schedule-v2.types';

const ScheduleDrawer = () => {
  const isScheduleDrawerOpen = useAppSelector(state => state.schedule?.isScheduleDrawerOpen);
  const selectedMemberId = useAppSelector(state => state.schedule?.selectedMemberId);
  const selectedDate = useAppSelector(state => state.schedule?.selectedDate);
  const dispatch = useAppDispatch();
  const { t } = useTranslation('schedule');

  // Debug selected state
  React.useEffect(() => {
    if (isScheduleDrawerOpen) {
      console.log('📂 Drawer opened with:', { selectedMemberId, selectedDate });
    }
  }, [isScheduleDrawerOpen, selectedMemberId, selectedDate]);

  // Fetch team members data
  const { data: teamDataResponse, isLoading: teamLoading } = useFetchScheduleMembersQuery();
  const teamData: Member[] = teamDataResponse?.body || [];

  // Find selected member or default to first member
  // Note: selectedMemberId is team_member_id from the cell click
  const selectedMember = selectedMemberId
    ? teamData.find((member: Member) => member.team_member_id === selectedMemberId)
    : teamData[0]; // Default to first member if none selected

  const items: TabsProps['items'] = [
    {
      key: '1',
      label: t('schedule') || '2024-11-04 - 2024-12-24',
      children: <WithStartAndEndDates />,
    },
    {
      key: '2',
      label: t('workloadManagement') || 'Resource Management',
      children: (
        <WorkloadManagement
          memberId={selectedMember?.team_member_id}
          onClose={() => dispatch(toggleScheduleDrawer())}
        />
      ),
    },
    // {
    //   key: '3',
    //   label: t('timeTracking') || 'Time Tracking',
    //   children: (
    //     <div style={{ padding: '20px', textAlign: 'center' }}>
    //       <h3>{t('timeTrackingFeature') || 'Time Tracking Feature'}</h3>
    //       <p style={{ color: '#666', marginTop: '16px' }}>
    //         {t('timeTrackingDesc') ||
    //           'Track time spent on tasks and projects. View detailed reports and analytics.'}
    //       </p>
    //       <p style={{ color: '#999', fontSize: '12px', marginTop: '20px' }}>
    //         {t('comingSoon') || 'Coming soon...'}
    //       </p>
    //     </div>
    //   ),
    // },
    // {
    //   key: '4',
    //   label: t('capacity') || 'Capacity Planning',
    //   children: (
    //     <div style={{ padding: '20px', textAlign: 'center' }}>
    //       <h3>{t('capacityPlanning') || 'Capacity Planning'}</h3>
    //       <p style={{ color: '#666', marginTop: '16px' }}>
    //         {t('capacityPlanningDesc') ||
    //           'Plan resource capacity for upcoming projects and identify potential bottlenecks.'}
    //       </p>
    //       <p style={{ color: '#999', fontSize: '12px', marginTop: '20px' }}>
    //         {t('comingSoon') || 'Coming soon...'}
    //       </p>
    //     </div>
    //   ),
    // },
  ];

  return (
    <Drawer
      width={1200}
      title={
        selectedMember ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CustomAvatar avatarName={selectedMember.name || ''} size={32} />
            <span>{selectedMember.name}</span>
            {teamLoading && <span style={{ fontSize: '12px', color: '#999' }}> (Loading...)</span>}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Avatar size={32}>?</Avatar>
            <span>
              {teamLoading ? t('loading') || 'Loading...' : t('selectMember') || 'Select Member'}
            </span>
          </div>
        )
      }
      onClose={() => dispatch(toggleScheduleDrawer())}
      open={isScheduleDrawerOpen}
    >
      <Tabs defaultActiveKey="1" type="card" items={items} />
    </Drawer>
  );
};

export default ScheduleDrawer;
