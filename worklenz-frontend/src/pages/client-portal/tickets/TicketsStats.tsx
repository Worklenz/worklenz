import { Alert, Button, Card, Col, Row, Skeleton, Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useGetTicketsStatsQuery } from '../../../api/client-portal/client-portal-api';

const { Text } = Typography;

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  isLoading: boolean;
}

const StatCard = ({ label, value, isLoading }: StatCardProps) => (
  <Card style={{ height: '100%', borderRadius: 8 }} styles={{ body: { padding: '18px 20px' } }}>
    <Skeleton active loading={isLoading} paragraph={{ rows: 1 }} title={false}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {label}
      </Text>
      <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2 }}>{value}</div>
    </Skeleton>
  </Card>
);

const TicketsStats = () => {
  const { t } = useTranslation('client-portal-tickets');
  const { data, isLoading, isError, refetch } = useGetTicketsStatsQuery();
  const stats = data?.body;

  if (isError) {
    return (
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message={t('statsErrorMessage', { defaultValue: 'Could not load ticket statistics.' })}
        action={
          <Button size="small" onClick={() => refetch()}>
            {t('retryButton', { defaultValue: 'Retry' })}
          </Button>
        }
      />
    );
  }

  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
      <Col xs={24} sm={12} lg={6}>
        <StatCard
          isLoading={isLoading}
          label={t('openTicketsStat', { defaultValue: 'Open tickets' })}
          value={stats?.open_tickets ?? 0}
        />
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <StatCard
          isLoading={isLoading}
          label={t('inProgressStat', { defaultValue: 'In progress' })}
          value={stats?.in_progress_tickets ?? 0}
        />
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <StatCard
          isLoading={isLoading}
          label={t('resolvedTodayStat', { defaultValue: 'Resolved today' })}
          value={stats?.resolved_today ?? 0}
        />
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <StatCard
          isLoading={isLoading}
          label={t('avgResponseStat', { defaultValue: 'Avg. response' })}
          value={stats?.avg_response_hours != null ? `${stats.avg_response_hours}h` : '—'}
        />
      </Col>
    </Row>
  );
};

export default TicketsStats;
