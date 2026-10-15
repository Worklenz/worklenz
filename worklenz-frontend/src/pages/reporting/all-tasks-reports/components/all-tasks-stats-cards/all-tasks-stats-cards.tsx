import { memo } from 'react';
import { Card, Skeleton, Typography, theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';

const AllTasksStatsCards = () => {
  const { t } = useTranslation('reporting-all-tasks');
  const { token } = theme.useToken();
  const { stats, isLoading } = useAppSelector(state => state.allTasksReportsReducer);

  const statsConfig = [
    {
      key: 'total',
      label: t('totalTasks', { defaultValue: 'Total Tasks' }),
      sub: t('totalTasksSub', { defaultValue: 'Matching current filters' }),
      value: stats.totalTasks,
      color: token.colorPrimary,
    },
    {
      key: 'completed',
      label: t('completedTasks', { defaultValue: 'Completed' }),
      sub: t('completedTasksSub', { defaultValue: 'Finished tasks' }),
      value: stats.completedTasks,
      color: token.colorSuccess,
    },
    {
      key: 'inProgress',
      label: t('inProgressTasks', { defaultValue: 'In Progress' }),
      sub: t('inProgressTasksSub', { defaultValue: 'Currently being worked on' }),
      value: stats.inProgressTasks,
      color: token.geekblue,
    },
    {
      key: 'overdue',
      label: t('overdueTasks', { defaultValue: 'Overdue' }),
      sub: t('overdueTasksSub', { defaultValue: 'Past their due date' }),
      value: stats.overdueTasks,
      color: token.colorError,
    },
    {
      key: 'unassigned',
      label: t('unassignedTasks', { defaultValue: 'Unassigned' }),
      sub: t('unassignedTasksSub', { defaultValue: 'No assignee yet' }),
      value: stats.unassignedTasks,
      color: token.colorWarning,
    },
    {
      key: 'dueThisWeek',
      label: t('dueThisWeekTasks', { defaultValue: 'Due This Week' }),
      sub: t('dueThisWeekTasksSub', { defaultValue: 'Coming up soon' }),
      value: stats.dueThisWeek,
      color: token.purple,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {statsConfig.map(item => (
        <Card key={item.key} size="small">
          <Typography.Text type="secondary" className="text-xs uppercase">
            {item.label}
          </Typography.Text>
          {isLoading ? (
            <Skeleton active title={{ width: 48 }} paragraph={false} className="py-2" />
          ) : (
            <div className="text-3xl font-semibold" style={{ color: item.color }}>
              {item.value}
            </div>
          )}
          <Typography.Text type="secondary" className="text-xs">
            {item.sub}
          </Typography.Text>
        </Card>
      ))}
    </div>
  );
};

export default memo(AllTasksStatsCards);
