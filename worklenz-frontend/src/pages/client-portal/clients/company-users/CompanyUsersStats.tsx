import { Alert, Button, Card, Col, Row, Skeleton, Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useGetCompanyUsersStatsQuery } from '@/api/client-portal/company-users-api';

const { Text } = Typography;

interface StatCardProps {
  label: string;
  value: number;
  hint?: string;
  isLoading: boolean;
}

const StatCard = ({ label, value, hint, isLoading }: StatCardProps) => (
  <Card style={{ height: '100%', borderRadius: 8 }} styles={{ body: { padding: '18px 20px' } }}>
    <Skeleton active loading={isLoading} paragraph={{ rows: 1 }} title={false}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {label}
      </Text>
      <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2 }}>{value}</div>
      {hint && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {hint}
        </Text>
      )}
    </Skeleton>
  </Card>
);

export const CompanyUsersStats = () => {
  const { t } = useTranslation('client-portal-company-users');
  const { data, isLoading, isError, refetch } = useGetCompanyUsersStatsQuery();
  const stats = data?.body;

  if (isError) {
    return (
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 24 }}
        message={t('statsErrorMessage', {
          defaultValue: 'Could not load client user statistics.',
        })}
        action={
          <Button size="small" onClick={() => refetch()}>
            {t('retryButton', { defaultValue: 'Retry' })}
          </Button>
        }
      />
    );
  }

  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
      <Col xs={24} sm={12} lg={6}>
        <StatCard
          isLoading={isLoading}
          label={t('stats.total', { defaultValue: 'Total client users' })}
          value={stats?.total ?? 0}
        />
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <StatCard
          isLoading={isLoading}
          label={t('stats.pocs', { defaultValue: 'POCs' })}
          value={stats?.pocs ?? 0}
        />
      </Col>
      <Col xs={24} sm={12} lg={6}>
        {/* Informational only: a company with no POC is valid, so this is not styled as a warning. */}
        <StatCard
          isLoading={isLoading}
          label={t('stats.companiesWithoutPoc', { defaultValue: 'Companies with no POC' })}
          value={stats?.companies_without_poc ?? 0}
          hint={t('stats.companiesWithoutPocHint', {
            defaultValue: 'Allowed. A company can have no POC.',
          })}
        />
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <StatCard
          isLoading={isLoading}
          label={t('stats.disabled', { defaultValue: 'Disabled' })}
          value={stats?.disabled ?? 0}
        />
      </Col>
    </Row>
  );
};
