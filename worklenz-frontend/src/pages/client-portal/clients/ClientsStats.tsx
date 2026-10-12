import {
  Alert,
  Button,
  Card,
  Col,
  Flex,
  Row,
  Skeleton,
  Tooltip,
  Typography,
  theme,
} from '@/shared/antd-imports';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useGetClientsStatsQuery } from '@/api/client-portal/client-portal-api';

const { Text } = Typography;

export const ClientsStats = () => {
  const { t } = useTranslation('client-portal-clients');
  const { token } = theme.useToken();
  const { data, isLoading, isError, refetch } = useGetClientsStatsQuery();
  const stats = data?.body;

  if (isError) {
    return (
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message={t('statsErrorMessage', { defaultValue: 'Could not load client statistics.' })}
        action={
          <Button size="small" onClick={() => refetch()}>
            {t('retryButton', { defaultValue: 'Retry' })}
          </Button>
        }
      />
    );
  }

  // Expired invitations are still awaiting the client, so they count as invited in the summary.
  const breakdown = [
    {
      key: 'active',
      label: t('portalStatus.active', { defaultValue: 'Active' }),
      value: stats?.active ?? 0,
      color: token.colorSuccess,
    },
    {
      key: 'invited',
      label: t('portalStatus.invited', { defaultValue: 'Invited' }),
      value: (stats?.invited ?? 0) + (stats?.expired ?? 0),
      color: token.colorWarning,
    },
    {
      key: 'notInvited',
      label: t('portalStatus.not_invited', { defaultValue: 'Not Invited' }),
      value: stats?.not_invited ?? 0,
      color: token.colorTextSecondary,
    },
  ];

  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
      <Col xs={24} md={12}>
        <Card
          style={{ height: '100%', borderRadius: 8 }}
          styles={{ body: { padding: '18px 20px' } }}
        >
          <Skeleton active loading={isLoading} paragraph={{ rows: 1 }} title={false}>
            <Flex justify="space-between" align="center" wrap="wrap" gap={16}>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('totalClientsLabel', { defaultValue: 'Total Clients' })}
                </Text>
                <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2 }}>
                  {stats?.total ?? 0}
                </div>
              </div>
              <Flex gap={18} wrap="wrap">
                {breakdown.map(item => (
                  <Text key={item.key} style={{ fontSize: 12 }}>
                    <Text strong style={{ fontSize: 12, color: item.color }}>
                      {item.value}
                    </Text>{' '}
                    <Text type="secondary">{item.label}</Text>
                  </Text>
                ))}
              </Flex>
            </Flex>
          </Skeleton>
        </Card>
      </Col>
      <Col xs={24} md={12}>
        <Card
          style={{ height: '100%', borderRadius: 8 }}
          styles={{ body: { padding: '18px 20px' } }}
        >
          <Skeleton active loading={isLoading} paragraph={false} title={false}>
            <Flex align="center" gap={6}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('unansweredMessagesLabel', { defaultValue: 'Unanswered messages' })}
              </Text>
              <Tooltip
                title={t('unansweredMessagesHint', {
                  defaultValue: 'Client messages waiting for a reply from your team',
                })}
              >
                <InfoCircleOutlined
                  style={{ fontSize: 12, color: token.colorTextSecondary, cursor: 'help' }}
                />
              </Tooltip>
            </Flex>
            <Tooltip
              title={t('unansweredMessagesHint', {
                defaultValue: 'Client messages waiting for a reply from your team',
              })}
            >
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  lineHeight: 1.2,
                  color: token.colorPrimary,
                  width: 'fit-content',
                  cursor: 'help',
                }}
              >
                {stats?.unanswered_messages ?? 0}
              </div>
            </Tooltip>
          </Skeleton>
        </Card>
      </Col>
    </Row>
  );
};
