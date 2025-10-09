import { useState, useEffect, useCallback } from 'react';
import { Modal, Form, message } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

import {
  slackApiService,
  type ISlackChannelConfig,
  type ISlackChannel,
} from '@api/slack/slack.api.service';
import apiClient from '@api/api-client';

import {
  SlackConnectedCard,
  SlackDisconnectedCard,
  SlackManageModal,
  SlackChannelFormModal,
} from './slack';

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
}

interface ApiResponse<T> {
  body?: {
    data?: T;
  };
}

export function SlackIntegration() {
  const { t } = useTranslation('settings/slack-integration');
  const [messageApi, contextHolder] = message.useMessage();
  const [isConnected, setIsConnected] = useState(false);
  const [workspace, setWorkspace] = useState<{
    id: string;
    name: string;
    team_id: string;
    is_active: boolean;
  } | null>(null);
  const [channels, setChannels] = useState<ISlackChannelConfig[]>([]);
  const [availableChannels, setAvailableChannels] = useState<ISlackChannel[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [manageModalVisible, setManageModalVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editingChannel, setEditingChannel] = useState<ISlackChannelConfig | null>(null);
  const [form] = Form.useForm<ChannelFormValues>();

  useEffect(() => {
    const initialize = async () => {
      await Promise.all([checkSlackConnection(), loadChannelConfigurations(), loadProjects()]);

      // Check for OAuth callback params
      const params = new URLSearchParams(window.location.search);
      const slackStatus = params.get('slack');

      // If opened in popup window (from OAuth), close it automatically
      const isPopup = window.opener && window.opener !== window;

      if (slackStatus === 'success') {
        if (isPopup) {
          // Notify parent window and close popup
          window.opener?.postMessage({ type: 'SLACK_AUTH_SUCCESS' }, window.location.origin);
          setTimeout(() => window.close(), 500);
        } else {
          messageApi.success(t('messages.connectedSuccess'));
          window.history.replaceState({}, '', window.location.pathname);
          await checkSlackConnection();
        }
      } else if (slackStatus === 'error') {
        if (isPopup) {
          window.opener?.postMessage({ type: 'SLACK_AUTH_ERROR' }, window.location.origin);
          setTimeout(() => window.close(), 500);
        } else {
          messageApi.error(t('errors.connectionFailed'));
          window.history.replaceState({}, '', window.location.pathname);
        }
      } else if (slackStatus === 'cancelled') {
        if (isPopup) {
          window.opener?.postMessage({ type: 'SLACK_AUTH_CANCELLED' }, window.location.origin);
          setTimeout(() => window.close(), 500);
        } else {
          messageApi.info(t('messages.installationCancelled'));
          window.history.replaceState({}, '', window.location.pathname);
        }
      }
    };

    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      console.error('Failed to check Slack connection:', error);
      messageApi.error(t('errors.connectionCheckFailed'));
    }
  }, [messageApi, t]);

  const loadChannelConfigurations = useCallback(async () => {
    try {
      const configs = await slackApiService.getAllChannelConfigs();
      setChannels(configs);
    } catch (error) {
      console.error('Failed to load channel configurations:', error);
      messageApi.error(t('errors.loadConfigsFailed'));
    }
  }, [messageApi, t]);

  const loadAvailableChannels = useCallback(async () => {
    try {
      const channels = await slackApiService.getAvailableChannels();
      setAvailableChannels(channels);
    } catch (error) {
      console.error('Failed to load available channels:', error);
      messageApi.error(t('errors.loadChannelsFailed'));
    }
  }, [messageApi, t]);

  const loadProjects = useCallback(async () => {
    try {
      const response = await apiClient.get<ApiResponse<Project[]>>('/api/v1/projects');
      setProjects(response.data?.body?.data || []);
    } catch (error) {
      console.error('Failed to load projects:', error);
      messageApi.error(t('errors.loadProjectsFailed'));
    }
  }, [messageApi, t]);

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
          messageApi.success(t('messages.connectedSuccess'));
          checkSlackConnection();
          setLoading(false);
          window.removeEventListener('message', handleMessage);
        } else if (event.data.type === 'SLACK_AUTH_ERROR') {
          messageApi.error(t('errors.connectionFailed'));
          setLoading(false);
          window.removeEventListener('message', handleMessage);
        } else if (event.data.type === 'SLACK_AUTH_CANCELLED') {
          messageApi.info(t('messages.installationCancelled'));
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
      console.error('Failed to initiate Slack connection:', error);
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
          messageApi.success(t('messages.disconnectedSuccess'));
        } catch (error) {
          console.error('Failed to disconnect Slack workspace:', error);
          messageApi.error(t('errors.disconnectFailed'));
        }
      },
    });
  }, [messageApi, t]);

  const handleAddChannel = useCallback(
    async (values: ChannelFormValues) => {
      try {
        await slackApiService.createChannelConfig(values);
        messageApi.success(t('messages.configAdded'));
        setAddModalVisible(false);
        form.resetFields();
        await loadChannelConfigurations();
      } catch (error) {
        console.error('Failed to add channel configuration:', error);
        messageApi.error(t('errors.addConfigFailed'));
      }
    },
    [form, loadChannelConfigurations, messageApi, t]
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
        await slackApiService.updateChannelConfig(editingChannel.id, values);
        messageApi.success(t('messages.configUpdated'));
        setAddModalVisible(false);
        setEditingChannel(null);
        form.resetFields();
        await loadChannelConfigurations();
      } catch (error) {
        console.error('Failed to update channel configuration:', error);
        messageApi.error(t('errors.updateConfigFailed'));
      }
    },
    [editingChannel, form, loadChannelConfigurations, messageApi, t]
  );

  const handleModalClose = useCallback(() => {
    setAddModalVisible(false);
    setEditingChannel(null);
    form.resetFields();
  }, [form]);

  const handleToggleChannel = useCallback(
    async (channelId: string, isActive: boolean) => {
      try {
        await slackApiService.updateChannelConfig(channelId, { isActive });
        messageApi.success(t('messages.statusUpdated'));
        await loadChannelConfigurations();
      } catch (error) {
        console.error('Failed to update channel status:', error);
        messageApi.error(t('errors.updateStatusFailed'));
      }
    },
    [loadChannelConfigurations, messageApi, t]
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
            messageApi.success(t('messages.configRemoved'));
            await loadChannelConfigurations();
          } catch (error) {
            console.error('Failed to remove channel configuration:', error);
            messageApi.error(t('errors.removeConfigFailed'));
          }
        },
      });
    },
    [loadChannelConfigurations, messageApi, t]
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
          onToggle={handleToggleChannel}
          onEdit={handleOpenEditModal}
          onDelete={handleDeleteChannel}
        />

        <SlackChannelFormModal
          open={addModalVisible}
          form={form}
          editingChannel={editingChannel}
          projects={projects}
          availableChannels={availableChannels}
          onClose={handleModalClose}
          onSubmit={handleFormSubmit}
        />
      </>
    );
  }

  // Disconnected state
  return (
    <>
      {contextHolder}
      <SlackDisconnectedCard loading={loading} onConnect={handleConnect} />
    </>
  );
}
