import { Button, Card, Flex, Typography } from '@/shared/antd-imports';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setSort } from '@/features/task-management/task-management.slice';
import StatusOverview from './graphs/status-overview';
import PriorityOverview from './graphs/priority-overview';
import LastUpdatedTasks from './tables/last-updated-tasks';
import ProjectDeadline from './tables/project-deadline';
import ProjectStats from '../project-stats/project-stats';
import { TFunction } from 'i18next';

const InsightsOverview = ({ t }: { t: TFunction }) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { projectId } = useAppSelector(state => state.projectInsightsReducer);

  const handleSeeAllLastUpdated = () => {
    dispatch(setSort({ field: 'updated_at', order: 'DESC' }));
    navigate(
      `/worklenz/projects/${projectId}?pinned_tab=tasks-list&sort_field=updated_at&sort_order=DESC`
    );
  };

  return (
    <div
      className="overflow-y-auto overflow-x-hidden px-6"
      style={{
        height: 'calc(100vh - 220px)',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(155, 155, 155, 0.5) transparent',
      }}
    >
      <Flex vertical gap={24} style={{ paddingBottom: '24px' }}>
        <ProjectStats t={t} />
        <Flex gap={24} className="grid md:grid-cols-2">
          <Card
            className="custom-insights-card"
            title={
              <Typography.Text style={{ fontSize: 16, fontWeight: 500 }}>
                {t('overview.statusOverview')}
              </Typography.Text>
            }
            style={{ width: '100%' }}
          >
            <StatusOverview />
          </Card>
          <Card
            className="custom-insights-card"
            title={
              <Typography.Text style={{ fontSize: 16, fontWeight: 500 }}>
                {t('overview.priorityOverview')}
              </Typography.Text>
            }
            style={{ width: '100%' }}
          >
            <PriorityOverview />
          </Card>
        </Flex>
        <Flex gap={24} className="grid lg:grid-cols-2">
          <Card
            className="custom-insights-card"
            title={
              <Typography.Text style={{ fontSize: 16, fontWeight: 500 }}>
                {t('overview.lastUpdatedTasks')}
              </Typography.Text>
            }
            extra={
              <Button type="link" onClick={handleSeeAllLastUpdated}>
                {t('common.seeAll')}
              </Button>
            }
            style={{ width: '100%' }}
          >
            <LastUpdatedTasks />
          </Card>
          <ProjectDeadline />
        </Flex>
      </Flex>
    </div>
  );
};

export default InsightsOverview;