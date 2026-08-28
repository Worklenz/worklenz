import { Drawer, Typography, Spin, Empty } from '@/shared/antd-imports';
import React, { useEffect, useState } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useTranslation } from 'react-i18next';
import { toggleMembersOverviewTasksStatsDrawer } from '../../../membersReportsSlice';
import { reportingApiService } from '@/api/reporting/reporting.api.service';
import logger from '@/utils/errorLogger';
import MembersOverviewTasksStatsTable from './members-overview-tasks-stats-table';

const TaskDrawer = React.lazy(() => import('@components/task-drawer/task-drawer'));

type MembersOverviewTasksStatsDrawerProps = {
  memberId: string | null;
};

const MembersOverviewTasksStatsDrawer = ({ memberId }: MembersOverviewTasksStatsDrawerProps) => {
  const [tasksData, setTasksData] = useState<any[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // localization
  const { t } = useTranslation('reporting-members-drawer');

  const dispatch = useAppDispatch();

  // get drawer open state from the member reports reducer
  const isDrawerOpen = useAppSelector(
    state => state.membersReportsReducer.isMembersOverviewTasksStatsDrawerOpen
  );
  const { membersList, selectedStatType, archived } = useAppSelector(state => state.membersReportsReducer);
  const { duration, dateRange } = useAppSelector(state => state.reportingReducer);

  // find the selected member based on memberId
  const selectedMember = membersList.find(member => member.id === memberId);

  // function to handle drawer close
  const handleClose = () => {
    dispatch(toggleMembersOverviewTasksStatsDrawer());
    setTasksData([]);
  };

  // fetch tasks data
  useEffect(() => {
    if (!isDrawerOpen || !memberId || !selectedStatType) {
      return;
    }

    const fetchTasks = async () => {
      try {
        setLoading(true);
        const additionalBody = {
          duration: duration,
          date_range: dateRange,
          only_single_member: true,
          archived: archived,
        };
        const response = await reportingApiService.getTasksByMember(
          memberId,
          null,
          false,
          null,
          additionalBody
        );

        if (response.done) {
          const allTasks = response.body;
          
          // Group by status for display - NO FILTERING, just group all tasks
          const groupedByStatus: { [key: string]: any[] } = {};
          allTasks.forEach((task: any) => {
            const statusName = task.status_name || 'Unknown';
            if (!groupedByStatus[statusName]) {
              groupedByStatus[statusName] = [];
            }
            groupedByStatus[statusName].push(task);
          });

          const formattedData = Object.entries(groupedByStatus).map(([statusName, tasks]) => ({
            name: statusName,
            color_code: tasks[0]?.status_color || '#999',
            tasks: tasks,
          }));

          setTasksData(formattedData);
        }
      } catch (error) {
        logger.error('fetchTasks in MembersOverviewTasksStatsDrawer', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [isDrawerOpen, memberId, selectedStatType, duration, dateRange, archived]);

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
      <Spin spinning={loading}>
        {tasksData && tasksData.length > 0 ? (
          tasksData.map((item, index) => (
            <MembersOverviewTasksStatsTable
              key={index}
              title={item.name}
              color={item.color_code}
              tasksData={item.tasks}
              setSeletedTaskId={setSelectedTaskId}
            />
          ))
        ) : (
          !loading && <Empty description={t('noTasksText', { defaultValue: 'No tasks' })} />
        )}
      </Spin>

      <TaskDrawer />
    </Drawer>
  );
};

export default MembersOverviewTasksStatsDrawer;
