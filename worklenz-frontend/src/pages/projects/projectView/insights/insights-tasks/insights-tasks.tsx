import { Button, Card, Flex, Tooltip, Typography } from '@/shared/antd-imports';
import { ExclamationCircleOutlined } from '@/shared/antd-imports';
import { colors } from '@/styles/colors';
import OverdueTasksTable from './tables/overdue-tasks-table';
import OverLoggedTasksTable from './tables/over-logged-tasks-table';
import TaskCompletedEarlyTable from './tables/task-completed-early-table';
import TaskCompletedLateTable from './tables/task-completed-late-table';
import ProjectStats from '../project-stats/project-stats';
import { TFunction } from 'i18next';
import { useAppSelector } from '@/hooks/useAppSelector';

const InsightsTasks = ({ t }: { t: TFunction }) => {
  const { includeArchivedTasks, projectId } = useAppSelector(state => state.projectInsightsReducer);

  return (
    <Flex vertical gap={24}>
      <ProjectStats t={t} />

      <Flex gap={24} className="grid lg:grid-cols-2">
        <Card
          className="custom-insights-card"
          title={
            <Typography.Text style={{ fontSize: 16, fontWeight: 500 }}>
              {t('tasks.overdueTasks')}
              <Tooltip title={t('tasks.overdueTasksTooltip')}>
                <ExclamationCircleOutlined
                  style={{
                    color: colors.skyBlue,
                    fontSize: 13,
                    marginInlineStart: 4,
                  }}
                />
              </Tooltip>
            </Typography.Text>
          }
          extra={<Button type="link">{t('common.seeAll')}</Button>}
          style={{ width: '100%' }}
        >
          <OverdueTasksTable projectId={projectId} includeArchivedTasks={includeArchivedTasks} />
        </Card>

        <Card
          className="custom-insights-card"
          title={
            <Typography.Text style={{ fontSize: 16, fontWeight: 500 }}>
              {t('tasks.overLoggedTasks')}
              <Tooltip title={t('tasks.overLoggedTasksTooltip')}>
                <ExclamationCircleOutlined
                  style={{
                    color: colors.skyBlue,
                    fontSize: 13,
                    marginInlineStart: 4,
                  }}
                />
              </Tooltip>
            </Typography.Text>
          }
          extra={<Button type="link">{t('common.seeAll')}</Button>}
          style={{ width: '100%' }}
        >
          <OverLoggedTasksTable projectId={projectId} includeArchivedTasks={includeArchivedTasks} />
        </Card>

        <Card
          className="custom-insights-card"
          title={
            <Typography.Text style={{ fontSize: 16, fontWeight: 500 }}>
              {t('tasks.tasksCompletedEarly')}
            </Typography.Text>
          }
          extra={<Button type="link">{t('common.seeAll')}</Button>}
          style={{ width: '100%' }}
        >
          <TaskCompletedEarlyTable
            projectId={projectId}
            includeArchivedTasks={includeArchivedTasks}
          />
        </Card>

        <Card
          className="custom-insights-card"
          title={
            <Typography.Text style={{ fontSize: 16, fontWeight: 500 }}>
              {t('tasks.tasksCompletedLate')}
            </Typography.Text>
          }
          extra={<Button type="link">{t('common.seeAll')}</Button>}
          style={{ width: '100%' }}
        >
          <TaskCompletedLateTable
            projectId={projectId}
            includeArchivedTasks={includeArchivedTasks}
          />
        </Card>
      </Flex>
    </Flex>
  );
};

export default InsightsTasks;
