import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Flex,
  Popconfirm,
  Skeleton,
  Space,
  Tag,
  Tooltip,
  Typography,
  message,
  theme,
} from '@/shared/antd-imports';
import {
  CheckCircleOutlined,
  GithubOutlined,
  LockOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { githubApiService, IGithubStatus } from '@/api/github/github.api.service';
import logger from '@/utils/errorLogger';

const REASON_MESSAGES: Record<string, { key: string; defaultValue: string }> = {
  invalid_state: {
    key: 'errors.invalidState',
    defaultValue: 'The connection request expired. Please try connecting again.',
  },
  forbidden: {
    key: 'errors.forbidden',
    defaultValue: 'You need access to this GitHub installation and must be a team owner or admin.',
  },
  already_connected: {
    key: 'errors.alreadyConnected',
    defaultValue: 'This GitHub account is already connected to another Worklenz team.',
  },
  team_already_connected: {
    key: 'errors.teamAlreadyConnected',
    defaultValue: 'This team is already connected to a different GitHub account. Disconnect it first.',
  },
};

/** Team-level GitHub connection card for Settings > Integrations. */
export const GithubIntegrationCard = () => {
  const { t } = useTranslation('github-integration');
  const { token } = theme.useToken();
  const [messageApi, contextHolder] = message.useMessage();

  const [status, setStatus] = useState<IGithubStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const loadStatus = useCallback(async () => {
    setIsLoading(true);
    setLoadFailed(false);
    try {
      const response = await githubApiService.getStatus();
      setStatus(response.body);
    } catch (error) {
      logger.error('Failed to load GitHub status', error);
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Surface the result of the GitHub install redirect, then clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('github');
    if (!result) return;

    const reason = params.get('reason') || '';
    if (result === 'success') {
      messageApi.success(
        t('messages.connected', { defaultValue: 'GitHub connected successfully.' })
      );
    } else if (result === 'requested') {
      messageApi.info(
        t('messages.requested', {
          defaultValue: 'Installation was requested. An organization owner needs to approve it.',
        })
      );
    } else {
      const known = REASON_MESSAGES[reason];
      messageApi.error(
        known
          ? t(known.key, { defaultValue: known.defaultValue })
          : t('errors.connectFailed', {
              defaultValue: 'Could not connect GitHub. Please try again.',
            })
      );
    }
    params.delete('github');
    params.delete('reason');
    const query = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }, [messageApi, t]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const response = await githubApiService.getInstallUrl();
      if (response.done && response.body?.url) {
        window.location.assign(response.body.url);
        return;
      }
      messageApi.error(
        t('errors.connectFailed', { defaultValue: 'Could not connect GitHub. Please try again.' })
      );
    } catch (error) {
      logger.error('Failed to start GitHub install', error);
      messageApi.error(
        t('errors.connectFailed', { defaultValue: 'Could not connect GitHub. Please try again.' })
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await githubApiService.refreshRepositories();
      await loadStatus();
      messageApi.success(
        t('messages.refreshed', { defaultValue: 'Repository list updated.' })
      );
    } catch (error) {
      logger.error('Failed to refresh GitHub repositories', error);
      messageApi.error(
        t('errors.refreshFailed', { defaultValue: 'Could not refresh repositories.' })
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await githubApiService.disconnect();
      await loadStatus();
      messageApi.success(t('messages.disconnected', { defaultValue: 'GitHub disconnected.' }));
    } catch (error) {
      logger.error('Failed to disconnect GitHub', error);
      messageApi.error(
        t('errors.disconnectFailed', { defaultValue: 'Could not disconnect GitHub.' })
      );
    } finally {
      setIsDisconnecting(false);
    }
  };

  const title = (
    <Flex align="center" gap={12}>
      <GithubOutlined style={{ fontSize: 32 }} aria-hidden />
      <Typography.Title level={5} style={{ margin: 0 }}>
        {t('title', { defaultValue: 'GitHub' })}
      </Typography.Title>
    </Flex>
  );

  const renderBody = () => {
    if (isLoading) return <Skeleton active paragraph={{ rows: 3 }} />;

    if (loadFailed || !status) {
      return (
        <Alert
          type="error"
          showIcon
          message={t('errors.loadFailed', { defaultValue: 'Could not load GitHub status.' })}
          action={
            <Button size="small" onClick={loadStatus}>
              {t('actions.retry', { defaultValue: 'Retry' })}
            </Button>
          }
        />
      );
    }

    if (!status.configured) {
      return (
        <Flex vertical gap={12}>
          <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
            {t('description', {
              defaultValue:
                'Link GitHub repositories to software projects to see branches, pull requests and commits on your issues.',
            })}
          </Typography.Paragraph>
          <Alert
            type="info"
            showIcon
            message={t('notConfigured.title', { defaultValue: 'Not configured' })}
            description={t('notConfigured.description', {
              defaultValue:
                'The GitHub App has not been set up for this Worklenz installation. Ask your administrator to configure it.',
            })}
          />
        </Flex>
      );
    }

    if (!status.connected || !status.integration) {
      return (
        <Flex vertical gap={16}>
          <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
            {t('description', {
              defaultValue:
                'Link GitHub repositories to software projects to see branches, pull requests and commits on your issues.',
            })}
          </Typography.Paragraph>
          <Tooltip
            title={
              status.can_manage
                ? undefined
                : t('connect.adminOnly', {
                    defaultValue: 'Only team owners and admins can connect GitHub.',
                  })
            }
          >
            <span>
              <Button
                type="primary"
                icon={<GithubOutlined />}
                loading={isConnecting}
                disabled={!status.can_manage}
                onClick={handleConnect}
                block
              >
                {t('connect.button', { defaultValue: 'Connect GitHub' })}
              </Button>
            </span>
          </Tooltip>
        </Flex>
      );
    }

    const { integration } = status;
    return (
      <Flex vertical gap={16}>
        <Flex align="center" gap={12}>
          <Avatar
            size={40}
            src={integration.account_avatar_url || undefined}
            icon={<GithubOutlined />}
          />
          <div style={{ minWidth: 0 }}>
            <Flex align="center" gap={8} wrap>
              <Typography.Text strong ellipsis>
                {integration.account_login}
              </Typography.Text>
              {integration.status === 'suspended' ? (
                <Tag color="warning">{t('status.suspended', { defaultValue: 'Suspended' })}</Tag>
              ) : (
                <Tag color="success" icon={<CheckCircleOutlined />}>
                  {t('status.connected', { defaultValue: 'Connected' })}
                </Tag>
              )}
            </Flex>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t('repositoryCount', {
                count: integration.repository_count,
                defaultValue: '{{count}} repositories available',
              })}
            </Typography.Text>
          </div>
        </Flex>

        <Typography.Paragraph type="secondary" style={{ margin: 0, fontSize: 13 }}>
          {t('connectedHint', {
            defaultValue:
              'Open a software project, then go to Settings > Integrations to link repositories.',
          })}
        </Typography.Paragraph>

        {status.can_manage && (
          <Flex justify="space-between" align="center" gap={8} wrap>
            <Button icon={<ReloadOutlined />} loading={isRefreshing} onClick={handleRefresh}>
              {t('actions.refresh', { defaultValue: 'Refresh repositories' })}
            </Button>
            <Popconfirm
              title={t('disconnect.title', { defaultValue: 'Disconnect GitHub?' })}
              description={t('disconnect.description', {
                defaultValue:
                  'Syncing will pause. Existing links and history are kept and resume if you reconnect.',
              })}
              okText={t('disconnect.confirm', { defaultValue: 'Disconnect' })}
              cancelText={t('actions.cancel', { defaultValue: 'Cancel' })}
              okButtonProps={{ danger: true, loading: isDisconnecting }}
              onConfirm={handleDisconnect}
            >
              <Button danger type="text">
                {t('disconnect.button', { defaultValue: 'Disconnect' })}
              </Button>
            </Popconfirm>
          </Flex>
        )}
      </Flex>
    );
  };

  return (
    <>
      {contextHolder}
      <Card
        title={title}
        style={{ height: '100%', borderColor: token.colorBorderSecondary }}
        extra={
          !status?.can_manage && status?.configured && !isLoading ? (
            <Space size={4} style={{ color: token.colorTextTertiary, fontSize: 12 }}>
              <LockOutlined aria-hidden />
              {t('viewOnly', { defaultValue: 'View only' })}
            </Space>
          ) : null
        }
      >
        {renderBody()}
      </Card>
    </>
  );
};

export default GithubIntegrationCard;
