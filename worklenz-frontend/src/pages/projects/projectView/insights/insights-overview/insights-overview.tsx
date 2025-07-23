import { Button, Card, Flex, Typography } from '@/shared/antd-imports';

import StatusOverview from './graphs/status-overview';
import PriorityOverview from './graphs/priority-overview';
import LastUpdatedTasks from './tables/last-updated-tasks';
import ProjectDeadline from './tables/project-deadline';
import ProjectStats from '../project-stats/project-stats';
import { TFunction } from 'i18next';

const InsightsOverview = ({ t }: { t: TFunction }) => {
  return (
    <Flex vertical gap={24}>
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
          extra={<Button type="link">{t('common.seeAll')}</Button>}
          style={{ width: '100%' }}
        >
          <LastUpdatedTasks />
        </Card>

        <ProjectDeadline />
      </Flex>
    </Flex>
  );
};

export default InsightsOverview;
