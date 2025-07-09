import { Drawer, Typography } from 'antd';
import React, { useEffect, useState } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useTranslation } from 'react-i18next';
import { toggleMembersOverviewProjectsStatsDrawer } from '../../../membersReportsSlice';
import MembersOverviewProjectsStatsTable from './members-overview-projects-stats-table';
import { reportingApiService } from '@/api/reporting/reporting.api.service';

type MembersOverviewProjectsStatsDrawerProps = {
  memberId: string | null;
};

const MembersOverviewProjectsStatsDrawer = ({
  memberId,
}: MembersOverviewProjectsStatsDrawerProps) => {
  const [projectsData, setProjectsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // localization
  const { t } = useTranslation('reporting-members-drawer');

  const dispatch = useAppDispatch();

  const isDrawerOpen = useAppSelector(
    state => state.membersReportsReducer.isMembersOverviewProjectsStatsDrawerOpen
  );
  const { membersList } = useAppSelector(state => state.membersReportsReducer);

  const selectedMember = membersList.find(member => member.id === memberId);

  const handleClose = () => {
    dispatch(toggleMembersOverviewProjectsStatsDrawer());
  };

  useEffect(() => {
    const fetchProjectsData = async () => {
      if (!memberId || !isDrawerOpen) return;

      try {
        setLoading(true);
        const body = {
          team_member_id: memberId,
          archived: false,
        };
        const response = await reportingApiService.getSingleMemberProjects(body);
        if (response.done) {
          setProjectsData(response.body.projects || []);
        } else {
          setProjectsData([]);
        }
      } catch (error) {
        console.error('Error fetching member projects:', error);
        setProjectsData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProjectsData();
  }, [memberId, isDrawerOpen]);

  return (
    <Drawer
      open={isDrawerOpen}
      onClose={handleClose}
      width={900}
      title={
        selectedMember && (
          <Typography.Text>
            {selectedMember.name}
            {t('projectsStatsOverviewDrawerTitle')}
          </Typography.Text>
        )
      }
    >
      <MembersOverviewProjectsStatsTable projectList={projectsData} loading={loading} />
    </Drawer>
  );
};

export default MembersOverviewProjectsStatsDrawer;
