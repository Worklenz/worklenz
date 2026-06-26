import { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal, Form, message } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

import {
  slackApiService,
  type ISlackChannelConfig,
  type ISlackChannel,
} from '@api/slack/slack.api.service';
import { useBusinessFeatures } from '@/worklenz-ee/hooks/use-business-features';

import {
  SlackConnectedCard,
  SlackDisconnectedCard,
  SlackManageModal,
  SlackChannelFormModal,
} from './slack';
import logger from '@/utils/errorLogger';

// Local type definitions
interface Project {
  id: string;
  name: string;
  key?: string;
}

interface ChannelFormValues {
  projectId: string;
  slackChannelId: string;
  notificationTypes: string[];
  autoJoin?: boolean;
}

interface ApiResponse<T> {
  body?: {
    data?: T;
  };
}

export function SlackIntegration() {
  const { t } = useTranslation('settings/slack-integration');
  const [messageApi, contextHolder] = message.useMessage();
  const { hasBusinessAccess } = useBusinessFeatures();
  const [isConnected, setIsConnected] = useState(false);
  const [workspace, setWorkspace] = useState<{
    id: string;
    name: string;
    team_id: string;
    is_active: boolean;
  } | null>(null);
  const [channels, setChannels] = useState<ISlackChannelConfig[]>([]);
  const [availableChannels, setAvailableChannels] = useState<ISlackChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [manageModalVisible, setManageModalVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editingChannel, setEditingChannel] = useState<ISlackChannelConfig | null>(null);
  const [form] = Form.useForm<ChannelFormValues>();

  useEffect(() => {
    const initialize = async () => {
      // Check for OAuth callback params first
      const params = new URLSearchParams(window.location.search);
      const slackStatus = params.get('slack');

      // If opened in popup window (from OAuth), close it automatically
      const isPopup = window.opener && window.opener !== window;

      if (slackStatus === 'success') {
        if (isPopup) {
          // Notify parent window and close popup immediately - don't make API calls
          window.opener?.postMessage({ type: 'SLACK_AUTH_SUCCESS' }, window.location.origin);
          window.close();
          return; // Exit early to prevent API calls
        } else {
          // Show success message in non-popup mode
          messageApi.success(
            t('connection.success', { defaultValue: 'Slack workspace connected successfully!' })
          );
          // Clean up URL params
          window.history.replaceState({}, '', window.location.pathname);
          // Update connection status
          await checkSlackConnection();
        }
      } else if (slackStatus === 'error') {
        if (isPopup) {
          window.opener?.postMessage({ type: 'SLACK_AUTH_ERROR' }, window.location.origin);
          window.close();
          return; // Exit early to prevent API calls
        } else {
          // Show error message in non-popup mode
          messageApi.error(
            t('connection.error', { defaultValue: 'Failed to connect Slack workspace' })
          );
          // Clean up URL params
          window.history.replaceState({}, '', window.location.pathname);
        }
      } else if (slackStatus === 'cancelled') {
        if (isPopup) {
          window.opener?.postMessage({ type: 'SLACK_AUTH_CANCELLED' }, window.location.origin);
          window.close();
          return; // Exit early to prevent API calls
        } else {
          // Show cancelled message in non-popup mode
          messageApi.info(
            t('connection.cancelled', { defaultValue: 'Slack installation cancelled' })
          );
          // Clean up URL params
          window.history.replaceState({}, '', window.location.pathname);
        }
      }

      // Only check connection if user has business access and NOT in popup
      if (hasBusinessAccess && !isPopup) {
        await Promise.all([checkSlackConnection(), loadChannelConfigurations()]);
      }
    };

    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBusinessAccess]);

  // Memoized API calls
  const checkSlackConnection = useCallback(async () => {
    try {
      const response = await slackApiService.getStatus();
      setIsConnected(response.connected);
      setWorkspace(response.workspace || null);

      if (response.connected) {
        await loadAvailableChannels();
      }
    } catch (error) {
      logger.error('Failed to check Slack connection', error);
    }
  }, []);

  const loadChannelConfigurations = useCallback(async () => {
    try {
      const configs = await slackApiService.getAllChannelConfigs();
      setChannels(configs);
    } catch (error) {
      logger.error('Failed to load channel configurations', error);
    }
  }, []);

  const loadAvailableChannels = useCallback(async () => {
    try {
      const channels = await slackApiService.getAvailableChannels();
      setAvailableChannels(channels);
    } catch (error) {
      logger.error('Failed to load available channels', error);
    }
  }, []);

  const handleConnect = useCallback(async () => {
    try {
      setLoading(true);
      const response = await slackApiService.getInstallUrl();

      // Open Slack OAuth in new window
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const authWindow = window.open(
        response.url,
        'slack-auth',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      // Listen for messages from popup
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;

        if (event.data.type === 'SLACK_AUTH_SUCCESS') {
          messageApi.success(
            t('connection.success', { defaultValue: 'Slack workspace connected successfully!' })
          );
          checkSlackConnection();
          setLoading(false);
          window.removeEventListener('message', handleMessage);
        } else if (event.data.type === 'SLACK_AUTH_ERROR') {
          messageApi.error(
            t('connection.error', { defaultValue: 'Failed to connect Slack workspace' })
          );
          setLoading(false);
          window.removeEventListener('message', handleMessage);
        } else if (event.data.type === 'SLACK_AUTH_CANCELLED') {
          messageApi.info(
            t('connection.cancelled', { defaultValue: 'Slack installation cancelled' })
          );
          setLoading(false);
          window.removeEventListener('message', handleMessage);
        }
      };

      window.addEventListener('message', handleMessage);

      // Fallback: Check if window was closed without message
      const checkInterval = setInterval(() => {
        if (authWindow?.closed) {
          clearInterval(checkInterval);
          window.removeEventListener('message', handleMessage);
          setLoading(false);
          checkSlackConnection();
        }
      }, 1000);
    } catch (error) {
      messageApi.error(t('errors.initiateConnectionFailed'));
      setLoading(false);
    }
  }, [checkSlackConnection, messageApi, t]);

  const handleDisconnect = useCallback(async () => {
    Modal.confirm({
      title: t('disconnect.title'),
      content: t('disconnect.content'),
      okText: t('disconnect.okText'),
      cancelText: t('cancel', { ns: 'common' }),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await slackApiService.disconnect();
          setIsConnected(false);
          setWorkspace(null);
          setChannels([]);
          setAvailableChannels([]);
        } catch (error) {
          logger.error('Failed to disconnect Slack workspace', error);
        }
      },
    });
  }, [messageApi, t]);

  const handleAddChannel = useCallback(
    async (values: ChannelFormValues) => {
      try {
        await slackApiService.createChannelConfig({ ...values, autoJoin: false });
        setAddModalVisible(false);
        form.resetFields();
        await loadChannelConfigurations();
      } catch (error) {
        logger.error('Failed to add channel configuration', error);
      }
    },
    [form, loadChannelConfigurations]
  );

  const handleOpenEditModal = useCallback(
    (channel: ISlackChannelConfig) => {
      setEditingChannel(channel);
      form.setFieldsValue({
        projectId: channel.projectId,
        slackChannelId: channel.slackChannelId,
        notificationTypes: channel.notificationTypes || [],
      });
      setAddModalVisible(true);
    },
    [form]
  );

  const handleUpdateChannel = useCallback(
    async (values: ChannelFormValues) => {
      if (!editingChannel) return;

      try {
        // Re-create the channel config with updated values (upsert behavior)
        await slackApiService.createChannelConfig({ ...values, autoJoin: false });
        setAddModalVisible(false);
        setEditingChannel(null);
        form.resetFields();
        await loadChannelConfigurations();
      } catch (error) {
        logger.error('Failed to update channel configuration', error);
      }
    },
    [editingChannel, form, loadChannelConfigurations, messageApi, t]
  );

  const handleModalClose = useCallback(() => {
    setAddModalVisible(false);
    setEditingChannel(null);
    form.resetFields();
  }, [form]);

  const handleReactivateChannel = useCallback(
    async (channelId: string) => {
      try {
        await slackApiService.reactivateChannelConfig(channelId);
        await loadChannelConfigurations();
      } catch (error) {
        logger.error('Failed to reactivate channel configuration', error);
      }
    },
    [loadChannelConfigurations]
  );

  const handleDeleteChannel = useCallback(
    async (channelId: string) => {
      Modal.confirm({
        title: t('deleteConfig.title'),
        content: t('deleteConfig.content'),
        okText: t('deleteConfig.okText'),
        cancelText: t('cancel', { ns: 'common' }),
        okButtonProps: { danger: true },
        onOk: async () => {
          try {
            await slackApiService.deleteChannelConfig(channelId);
            await loadChannelConfigurations();
          } catch (error) {
            logger.error('Failed to delete channel configuration', error);
          }
        },
      });
    },
    [loadChannelConfigurations]
  );

  const handleFormSubmit = useCallback(
    (values: ChannelFormValues) => {
      if (editingChannel) {
        handleUpdateChannel(values);
      } else {
        handleAddChannel(values);
      }
    },
    [editingChannel, handleUpdateChannel, handleAddChannel]
  );

  if (isConnected) {
    return (
      <>
        {contextHolder}
        <div className="space-y-6">
          <SlackConnectedCard
            workspace={workspace}
            channels={channels}
            availableChannels={availableChannels}
            onManage={() => setManageModalVisible(true)}
            onDisconnect={handleDisconnect}
          />
        </div>

        <SlackManageModal
          open={manageModalVisible}
          channels={channels}
          loading={loading}
          onClose={() => setManageModalVisible(false)}
          onAddNew={() => setAddModalVisible(true)}
          onEdit={handleOpenEditModal}
          onDelete={handleDeleteChannel}
          onReactivate={handleReactivateChannel}
        />

        <SlackChannelFormModal
          open={addModalVisible}
          form={form}
          editingChannel={editingChannel}
          availableChannels={availableChannels}
          onClose={handleModalClose}
          onSubmit={handleFormSubmit}
          onRefreshChannels={loadAvailableChannels}
        />
      </>
    );
  }

  // Disconnected state
  return (
    <>
      {contextHolder}
      <SlackDisconnectedCard
        loading={loading}
        onConnect={handleConnect}
        hasBusinessAccess={hasBusinessAccess}
      />
    </>
  );
}
