import { Card, Col, Row, Statistic, Skeleton } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import './all-tasks-stats-cards.css';

const AllTasksStatsCards = () => {
  const { t } = useTranslation('reporting-all-tasks');
  const { stats, isLoading } = useAppSelector(state => state.allTasksReportsReducer);

  const statsConfig = [
    {
      key: 'total',
      title: t('totalTasks'),
      value: stats.totalTasks,
      className: 'stats-card',
    },
    {
      key: 'completed',
      title: t('completedTasks'),
      value: stats.completedTasks,
      className: 'stats-card stats-card--completed',
    },
    {
      key: 'inProgress',
      title: t('inProgressTasks'),
      value: stats.inProgressTasks,
      className: 'stats-card stats-card--in-progress',
    },
    {
      key: 'overdue',
      title: t('overdueTasks'),
      value: stats.overdueTasks,
      className: 'stats-card stats-card--overdue',
    },
    {
      key: 'unassigned',
      title: t('unassignedTasks'),
      value: stats.unassignedTasks,
      className: 'stats-card stats-card--unassigned',
    },
    {
      key: 'dueThisWeek',
      title: t('dueThisWeekTasks'),
      value: stats.dueThisWeek,
      className: 'stats-card stats-card--due-week',
    },
  ];

  if (isLoading) {
    return (
      <Row gutter={[16, 16]}>
        {statsConfig.map(stat => (
          <Col key={stat.key} xs={12} sm={8} md={6} lg={4}>
            <Card className={stat.className}>
              <Skeleton active paragraph={false} />
            </Card>
          </Col>
        ))}
      </Row>
    );
  }

  return (
    <Row gutter={[16, 16]}>
      {statsConfig.map(stat => (
        <Col key={stat.key} xs={12} sm={8} md={6} lg={4}>
          <Card className={stat.className}>
            <Statistic title={stat.title} value={stat.value} />
          </Card>
        </Col>
      ))}
    </Row>
  );
};

export default AllTasksStatsCards;
