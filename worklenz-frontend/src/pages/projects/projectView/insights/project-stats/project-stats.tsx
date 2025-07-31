import ProjectStatsCard from '@/components/projects/project-stats-card';
import { Flex, Tooltip } from 'antd';
import checkIcon from '@assets/icons/insightsIcons/insights-check.png';
import clipboardIcon from '@assets/icons/insightsIcons/clipboard.png';
import clockIcon from '@assets/icons/insightsIcons/clock-green.png';
import warningIcon from '@assets/icons/insightsIcons/warning.png';
import { useEffect, useState } from 'react';
import { projectInsightsApiService } from '@/api/projects/insights/project-insights.api.service';
import { IProjectInsightsGetRequest } from '@/types/project/projectInsights.types';
import logger from '@/utils/errorLogger';
import { TFunction } from 'i18next';
import { useParams } from 'react-router-dom';
import { useAppSelector } from '@/hooks/useAppSelector';

const ProjectStats = ({ t }: { t: TFunction }) => {
  const { includeArchivedTasks, projectId } = useAppSelector(state => state.projectInsightsReducer);
  const [stats, setStats] = useState<IProjectInsightsGetRequest>({});
  const [loading, setLoading] = useState(false);
  const { refreshTimestamp } = useAppSelector(state => state.projectReducer);

  const getProjectStats = async () => {
    if (!projectId) return;

    setLoading(true);
    try {
      const res = await projectInsightsApiService.getProjectOverviewData(
        projectId,
        includeArchivedTasks
      );
      if (res.done) {
        setStats(res.body);
      }
    } catch (err) {
      logger.error('Error fetching project stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getProjectStats();
  }, [projectId, includeArchivedTasks, refreshTimestamp]);

  const tooltipTable = (
    <table>
      <tbody>
        <tr style={{ display: 'flex', gap: 12 }}>
          <td style={{ width: 120 }}>{t('common.totalEstimation')}</td>
          <td>{stats.total_estimated_hours_string || '0h'}</td>
        </tr>
        <tr style={{ display: 'flex', gap: 12 }}>
          <td style={{ width: 120 }}>{t('common.totalLogged')}</td>
          <td>{stats.total_logged_hours_string || '0h'}</td>
        </tr>
      </tbody>
    </table>
  );

  return (
    <Flex gap={24} className="grid sm:grid-cols-2 sm:grid-rows-2 lg:grid-cols-4 lg:grid-rows-1">
      <ProjectStatsCard
        icon={checkIcon}
        title={t('common.completedTasks')}
        loading={loading}
        children={stats.completed_tasks_count ?? 0}
      />
      <ProjectStatsCard
        icon={clipboardIcon}
        title={t('common.incompleteTasks')}
        loading={loading}
        children={stats.todo_tasks_count ?? 0}
      />
      <ProjectStatsCard
        icon={warningIcon}
        title={t('common.overdueTasks')}
        tooltip={t('common.overdueTasksTooltip')}
        loading={loading}
        children={stats.overdue_count ?? 0}
      />
      <ProjectStatsCard
        icon={clockIcon}
        title={t('common.totalLoggedHours')}
        tooltip={t('common.totalLoggedHoursTooltip')}
        loading={loading}
        children={
          <Tooltip title={tooltipTable} trigger={'hover'}>
            {stats.total_logged_hours_string || '0h'}
          </Tooltip>
        }
      />
    </Flex>
  );
};

export default ProjectStats;
