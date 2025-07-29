import { Drawer, Typography } from '@/shared/antd-imports';
import React, { useMemo, useState } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useTranslation } from 'react-i18next';
import { toggleMembersOverviewTasksStatsDrawer } from '../../../membersReportsSlice';
import { fetchData } from '@/utils/fetchData';
import MembersOverviewTasksStatsTable from './members-overview-tasks-stats-table';

const TaskDrawer = React.lazy(() => import('@components/task-drawer/task-drawer'));

type MembersOverviewTasksStatsDrawerProps = {
  memberId: string | null;
};

const MembersOverviewTasksStatsDrawer = ({ memberId }: MembersOverviewTasksStatsDrawerProps) => {
  const [tasksData, setTasksData] = useState<any[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // localization
  const { t } = useTranslation('reporting-members-drawer');

  const dispatch = useAppDispatch();

  // get drawer open state from the member reports reducer
  const isDrawerOpen = useAppSelector(
    state => state.membersReportsReducer.isMembersOverviewTasksStatsDrawerOpen
  );
  const { membersList } = useAppSelector(state => state.membersReportsReducer);

  // find the selected member based on memberId
  const selectedMember = membersList.find(member => member.id === memberId);

  // function to handle drawer close
  const handleClose = () => {
    dispatch(toggleMembersOverviewTasksStatsDrawer());
  };

  // useMemo for memoizing the fetch functions
  useMemo(() => {
    fetchData('/reportingMockData/membersReports/tasksStatsOverview.json', setTasksData);
  }, []);

  return (
    <Drawer
      open={isDrawerOpen}
      onClose={handleClose}
      width={900}
      title={
        selectedMember && (
          <Typography.Text>
            {selectedMember.name}
            {t('tasksStatsOverviewDrawerTitle')}
          </Typography.Text>
        )
      }
    >
      {tasksData &&
        tasksData.map((item, index) => (
          <MembersOverviewTasksStatsTable
            key={index}
            title={item.name}
            color={item.color_code}
            tasksData={item.tasks}
            setSeletedTaskId={setSelectedTaskId}
          />
        ))}

      <TaskDrawer />
    </Drawer>
  );
};

export default MembersOverviewTasksStatsDrawer;
