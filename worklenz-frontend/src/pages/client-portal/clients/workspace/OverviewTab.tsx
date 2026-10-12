import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Flex,
  Row,
  Skeleton,
  Typography,
  theme,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import {
  ClientActivityCategory,
  ClientWorkspaceStats,
  useGetClientActivityFeedQuery,
} from '@/api/client-portal/client-workspace-api';
import { fromNow } from '@/utils/dateUtils';
import { getActivityLetter } from './workspace-helpers';

const { Text } = Typography;

interface OverviewTabProps {
  clientId: string;
  clientName: string;
  stats: ClientWorkspaceStats | undefined;
  isStatsLoading: boolean;
  isStatsError: boolean;
  onRetryStats: () => void;
}

/** What is happening with this client: recent activity and the three numbers that need attention. */
export const OverviewTab = ({
  clientId,
  clientName,
  stats,
  isStatsLoading,
  isStatsError,
  onRetryStats,
}: OverviewTabProps) => {
  const { t } = useTranslation('client-portal-client-workspace');
  const { token } = theme.useToken();

  const {
    data: activityData,
    isLoading: isActivityLoading,
    isError: isActivityError,
    refetch: refetchActivity,
  } = useGetClientActivityFeedQuery({ clientId, limit: 10 }, { refetchOnMountOrArgChange: true });
  const activities = activityData?.body?.activities ?? [];

  const dotColors: Record<ClientActivityCategory, string> = {
    project: token.colorPrimary,
    request: token.colorWarning,
    invoice: token.colorSuccess,
    chat: token.colorInfo,
  };

  const statCards = [
    {
      key: 'tasks',
      label: t('overview.tasksOpen', { defaultValue: 'Tasks open' }),
      value: stats?.tasksOpen ?? 0,
    },
    {
      key: 'invoices',
      label: t('overview.invoicesDue', { defaultValue: 'Invoices due' }),
      value: stats?.invoicesDue ?? 0,
    },
    {
      key: 'messages',
      label: t('overview.unansweredMessages', { defaultValue: 'Unanswered messages' }),
      value: stats?.unansweredMessages ?? 0,
    },
  ];

  return (
    <Flex vertical gap={16}>
      {isStatsError ? (
        <Alert
          type="warning"
          showIcon
          message={t('overview.statsError', {
            defaultValue: 'Could not load this client’s numbers.',
          })}
          action={
            <Button size="small" onClick={onRetryStats}>
              {t('retry', { defaultValue: 'Retry' })}
            </Button>
          }
        />
      ) : (
        <Row gutter={[16, 16]}>
          {statCards.map(card => (
            <Col key={card.key} xs={24} sm={8}>
              <Card style={{ borderRadius: 8 }} styles={{ body: { padding: '16px 20px' } }}>
                <Skeleton active loading={isStatsLoading} paragraph={{ rows: 1 }} title={false}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {card.label}
                  </Text>
                  <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2 }}>{card.value}</div>
                </Skeleton>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Card
        style={{ borderRadius: 8 }}
        title={t('overview.recentActivity', { defaultValue: 'Recent activity' })}
      >
        {isActivityError ? (
          <Alert
            type="error"
            showIcon
            message={t('overview.activityError', {
              defaultValue: 'Could not load recent activity.',
            })}
            action={
              <Button size="small" onClick={() => refetchActivity()}>
                {t('retry', { defaultValue: 'Retry' })}
              </Button>
            }
          />
        ) : isActivityLoading ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : activities.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('overview.noActivity', {
              name: clientName,
              defaultValue: 'Nothing logged for {{name}} yet.',
            })}
          />
        ) : (
          <Flex vertical gap={14} role="list">
            {activities.map(activity => (
              <Flex key={activity.id} gap={12} align="center" role="listitem">
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    width: 30,
                    height: 30,
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: '50%',
                    color: dotColors[activity.category] ?? token.colorPrimary,
                    background: token.colorFillTertiary,
                  }}
                >
                  {getActivityLetter(activity.category)}
                </span>
                <Flex vertical style={{ minWidth: 0, flex: 1 }}>
                  <Text>{activity.description}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {fromNow(activity.activityDate)}
                  </Text>
                </Flex>
              </Flex>
            ))}
          </Flex>
        )}
      </Card>
    </Flex>
  );
};
