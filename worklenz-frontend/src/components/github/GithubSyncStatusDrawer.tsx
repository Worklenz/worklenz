import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Drawer,
  Empty,
  Flex,
  Skeleton,
  Statistic,
  Table,
  Typography,
  message,
} from '@/shared/antd-imports';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { githubApiService, IGithubSyncStatus } from '@/api/github/github.api.service';
import logger from '@/utils/errorLogger';

dayjs.extend(relativeTime);

interface GithubSyncStatusDrawerProps {
  open: boolean;
  onClose: () => void;
}

/** Webhook health for the team, with a retry action for failed events. */
export const GithubSyncStatusDrawer = ({ open, onClose }: GithubSyncStatusDrawerProps) => {
  const { t } = useTranslation('github-integration');
  const [messageApi, contextHolder] = message.useMessage();
  const [status, setStatus] = useState<IGithubSyncStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadFailed(false);
    try {
      const response = await githubApiService.getSyncStatus();
      setStatus(response.body);
    } catch (error) {
      logger.error('Failed to load GitHub sync status', error);
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const handleRetry = async (eventId: string) => {
    setRetryingId(eventId);
    try {
      await githubApiService.retryEvent(eventId);
      messageApi.success(t('sync.retried', { defaultValue: 'Event queued for retry.' }));
      await load();
    } catch (error) {
      logger.error('Failed to retry GitHub event', error);
      messageApi.error(t('sync.retryFailed', { defaultValue: 'Could not retry the event.' }));
    } finally {
      setRetryingId(null);
    }
  };

  const counts = status?.counts ?? {};

  return (
    <>
      {contextHolder}
      <Drawer
        open={open}
        onClose={onClose}
        width={560}
        title={t('sync.title', { defaultValue: 'GitHub sync status' })}
        extra={
          <Button onClick={() => void load()} loading={isLoading}>
            {t('sync.refresh', { defaultValue: 'Refresh' })}
          </Button>
        }
      >
        {isLoading && !status ? (
          <Skeleton active />
        ) : loadFailed || !status ? (
          <Alert
            type="error"
            showIcon
            message={t('sync.loadFailed', { defaultValue: 'Could not load sync status.' })}
          />
        ) : !status.connected ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('sync.notConnected', { defaultValue: 'GitHub is not connected.' })}
          />
        ) : (
          <Flex vertical gap={20}>
            <Typography.Text type="secondary">
              {status.last_event_at
                ? t('sync.lastEvent', {
                    defaultValue: 'Last event received {{time}}',
                    time: dayjs(status.last_event_at).fromNow(),
                  })
                : t('sync.never', { defaultValue: 'No events received yet.' })}
            </Typography.Text>

            <Flex gap={24} wrap>
              <Statistic
                title={t('sync.processed', { defaultValue: 'Processed (7 days)' })}
                value={counts.processed ?? 0}
              />
              <Statistic
                title={t('sync.pending', { defaultValue: 'Pending' })}
                value={(counts.pending ?? 0) + (counts.processing ?? 0)}
              />
              <Statistic
                title={t('sync.ignored', { defaultValue: 'Ignored' })}
                value={counts.ignored ?? 0}
              />
              <Statistic
                title={t('sync.failed', { defaultValue: 'Failed' })}
                value={counts.failed ?? 0}
                valueStyle={
                  counts.failed ? { color: 'var(--ant-color-error, #ff4d4f)' } : undefined
                }
              />
            </Flex>

            <div>
              <Typography.Title level={5} style={{ marginTop: 0 }}>
                {t('sync.failedEvents', { defaultValue: 'Failed events' })}
              </Typography.Title>
              {status.failed.length === 0 ? (
                <Alert
                  type="success"
                  showIcon
                  message={t('sync.noFailures', {
                    defaultValue: 'No failed events. Everything is syncing.',
                  })}
                />
              ) : (
                <Table
                  size="small"
                  rowKey="id"
                  pagination={false}
                  dataSource={status.failed}
                  columns={[
                    {
                      title: t('sync.event', { defaultValue: 'Event' }),
                      dataIndex: 'event_type',
                      width: 130,
                    },
                    {
                      title: t('sync.error', { defaultValue: 'Error' }),
                      dataIndex: 'error_message',
                      render: (value: string | null) => (
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {value || '-'}
                        </Typography.Text>
                      ),
                    },
                    {
                      title: t('sync.received', { defaultValue: 'Received' }),
                      dataIndex: 'received_at',
                      width: 110,
                      render: (value: string) => dayjs(value).fromNow(),
                    },
                    {
                      title: '',
                      width: 80,
                      render: (_: unknown, event) => (
                        <Button
                          size="small"
                          loading={retryingId === event.id}
                          onClick={() => void handleRetry(event.id)}
                        >
                          {t('sync.retry', { defaultValue: 'Retry' })}
                        </Button>
                      ),
                    },
                  ]}
                />
              )}
            </div>
          </Flex>
        )}
      </Drawer>
    </>
  );
};

export default GithubSyncStatusDrawer;
