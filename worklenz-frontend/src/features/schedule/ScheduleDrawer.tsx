import { Avatar, Drawer, Tabs, TabsProps } from '@/shared/antd-imports';
import React, { useEffect } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleScheduleDrawer } from './scheduleSliceRTK';
import WithStartAndEndDates from '../../components/schedule-old/tabs/withStartAndEndDates/WithStartAndEndDates';
import WorkloadManagement from './WorkloadManagement';
import { useTranslation } from 'react-i18next';
import { useFetchScheduleMembersQuery } from '@/api/schedule/scheduleApi';
import { useGetProjectQuery } from '@/api/projects/projects.v1.api.service';
import CustomAvatar from '@/components/CustomAvatar';
import { Member } from '@/types/schedule/schedule-v2.types';
import { setProjectId } from '@/features/project/project.slice';
import { useScheduleSocketHandlers } from '@/hooks/useScheduleSocketHandlers';

const ScheduleDrawer = () => {
  const isScheduleDrawerOpen = useAppSelector(state => state.schedule?.isScheduleDrawerOpen);
  const selectedMemberId = useAppSelector(state => state.schedule?.selectedMemberId);
  const selectedProjectId = useAppSelector(state => state.schedule?.selectedProjectId);
  const selectedSegmentData = useAppSelector(state => state.schedule?.selectedSegmentData);
  const selectedDateRange = useAppSelector(state => state.schedule?.selectedDateRange);
  const dispatch = useAppDispatch();
  const { t } = useTranslation('schedule');

  // Initialize schedule socket handlers for real-time updates
  useScheduleSocketHandlers();

  // Fetch team members data
  const { data: teamDataResponse, isLoading: teamLoading } = useFetchScheduleMembersQuery();
  const teamData: Member[] = teamDataResponse?.body || [];

  // Fetch project details directly if a project is selected
  const { data: projectResponse } = useGetProjectQuery(selectedProjectId || '', {
    skip: !selectedProjectId,
  });

  // Find selected member
  const selectedMember = selectedMemberId
    ? teamData.find((member: Member) => member.team_member_id === selectedMemberId)
    : teamData[0];

  // Get selected project from the direct project query
  const selectedProject = projectResponse?.body || null;

  // Set project ID in Redux when a project is selected
  useEffect(() => {
    if (selectedProjectId) {
      dispatch(setProjectId(selectedProjectId));
    }
  }, [selectedProjectId, dispatch]);

  const items: TabsProps['items'] = [
    {
      key: '1',
      label: t('schedule') || '2024-11-04 - 2024-12-24',
      children: <WithStartAndEndDates />,
    },
    // {
    //   key: '2',
    //   label: t('workloadManagement') || 'Resource Management',
    //   children: (
    //     <WorkloadManagement
    //       memberId={selectedMember?.team_member_id}
    //       onClose={() => dispatch(toggleScheduleDrawer())}
    //     />
    //   ),
    // },
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
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '14px', fontWeight: 600 }}>{selectedMember.name}</span>
              {selectedProject && (
                <span style={{ fontSize: '12px', color: '#999', fontWeight: 'normal' }}>
                  {selectedProject.name}
                </span>
              )}
            </div>
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
