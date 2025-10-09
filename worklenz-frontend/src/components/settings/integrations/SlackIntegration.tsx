import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button, Card, Switch, Select, Table, Tag, Modal, Form, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  SlackOutlined,
  PlusOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { SlackIcon } from './IntegrationIcons';

import {
  slackApiService,
  type ISlackChannelConfig,
  type ISlackChannel,
} from '@api/slack/slack.api.service';
import apiClient from '@api/api-client'; // Used for projects endpoint

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

// Notification type options
const NOTIFICATION_OPTIONS = [
  { value: 'task_created', label: 'Task Created' },
  { value: 'task_completed', label: 'Task Completed' },
  { value: 'task_assigned', label: 'Task Assigned' },
  { value: 'comment_added', label: 'Comment Added' },
  { value: 'due_date_reminder', label: 'Due Date Reminder' },
];

export const SlackIntegration = () => {
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

  // Memoized table columns
  const columns: ColumnsType<ISlackChannelConfig> = useMemo(
    () => [
      {
        title: t('table.project'),
        dataIndex: 'projectName',
        key: 'projectName',
      },
      {
        title: t('table.slackChannel'),
        dataIndex: 'slackChannelName',
        key: 'slackChannelName',
        render: (text: string) => (
          <Tag color="purple" className="font-medium">
            #{text}
          </Tag>
        ),
      },
      {
        title: t('table.notifications'),
        dataIndex: 'notificationTypes',
        key: 'notificationTypes',
        render: (types: string[] | undefined | null) => (
          <div className="flex flex-wrap gap-1">
            {(types ?? []).map(type => {
              const formattedType = type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
              return (
                <Tag key={type} color="blue" className="m-0">
                  {formattedType}
                </Tag>
              );
            })}
          </div>
        ),
      },
      {
        title: t('table.active'),
        dataIndex: 'isActive',
        key: 'isActive',
        render: (isActive: boolean, record: ISlackChannelConfig) => (
          <Switch
            checked={isActive}
            onChange={checked => handleToggleChannel(record.id, checked)}
            aria-label={t('table.toggleStatus', { channel: record.slackChannelName })}
          />
        ),
      },
      {
        title: t('table.actions'),
        key: 'actions',
        render: (_: unknown, record: ISlackChannelConfig) => (
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteChannel(record.id)}
            aria-label={t('table.deleteConfig', { channel: record.slackChannelName })}
          />
        ),
      },
    ],
    [t, handleToggleChannel, handleDeleteChannel]
  );

  if (isConnected) {
    // Connected state - clean design matching reference image
    return (
      <>
        {contextHolder}
        <Card
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200"
          styles={{ body: { padding: '40px 32px' } }}
        >
          {/* Icon */}
          <div className="flex flex-col items-center justify-between h-full mb-6">
            {/* Icon */}
            <div className="text-6xl text-center">
              <SlackIcon />
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 m-0">
              {t('title', { defaultValue: 'Slack Integration' })}
            </h3>
          </div>

          {/* Workspace info with status */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span>{workspace?.name || 'Workspace'}</span>
              <span>•</span>
              <Tag color="success" className="m-0" style={{ fontSize: '12px', padding: '0 8px' }}>
                <CheckCircleOutlined style={{ fontSize: '12px' }} className="mr-1" />
                {t('status.connected', { defaultValue: 'Connected' })}
              </Tag>
              <span>•</span>
              <span>
                {channels.length} {channels.length === 1 ? 'configuration' : 'configurations'}
              </span>
            </div>
          </div>

          {/* Action Buttons at bottom */}
          <div className="flex gap-3">
            <Button
              type="primary"
              icon={<SettingOutlined />}
              onClick={() => setManageModalVisible(true)}
              className="flex-1"
            >
              {t('manageConfigurations', { defaultValue: 'Manage' })}
            </Button>
            <Button danger onClick={handleDisconnect} className="flex-1">
              {t('disconnect.okText', { defaultValue: 'Disconnect' })}
            </Button>
          </div>
        </Card>

        {/* Modal for managing configurations */}
        <Modal
          title={
            <div className="flex items-center gap-3">
              <SlackIcon />
              <span>{t('manageTitle', { defaultValue: 'Manage Slack Configurations' })}</span>
            </div>
          }
          open={manageModalVisible}
          onCancel={() => setManageModalVisible(false)}
          footer={null}
          width={900}
        >
          {/* Info Banner */}
          {channels.length === 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-800 dark:text-blue-200 m-0">
                💡 Get started by adding a channel configuration to receive notifications from your
                projects.
              </p>
            </div>
          )}

          <div className="mb-4 flex justify-end">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalVisible(true)}>
              {t('addChannelConfig', { defaultValue: 'Add Channel' })}
            </Button>
          </div>

          {/* Table Section */}
          <Table
            columns={columns}
            dataSource={channels}
            rowKey="id"
            loading={loading}
            aria-label={t('table.channelConfigs')}
            pagination={channels.length > 10 ? { pageSize: 10 } : false}
            locale={{
              emptyText: (
                <div className="py-8 text-center">
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    No channel configurations yet
                  </p>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setAddModalVisible(true)}
                  >
                    Add Your First Channel
                  </Button>
                </div>
              ),
            }}
          />
        </Modal>

        {/* Modal for adding new configuration */}
        <Modal
          title={t('modal.configureChannel', { defaultValue: 'Configure Slack Channel' })}
          open={addModalVisible}
          onCancel={() => setAddModalVisible(false)}
          footer={null}
        >
          <Form form={form} layout="vertical" onFinish={handleAddChannel}>
            <Form.Item
              name="projectId"
              label={t('modal.project', { defaultValue: 'Project' })}
              rules={[
                {
                  required: true,
                  message: t('validation.selectProject', {
                    defaultValue: 'Please select a project',
                  }),
                },
              ]}
            >
              <Select
                placeholder={t('modal.selectProject', { defaultValue: 'Select a project' })}
                showSearch
                optionFilterProp="children"
              >
                {projects.map(project => (
                  <Select.Option key={project.id} value={project.id}>
                    {project.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="slackChannelId"
              label={t('modal.slackChannel', { defaultValue: 'Slack Channel' })}
              rules={[
                {
                  required: true,
                  message: t('validation.selectChannel', {
                    defaultValue: 'Please select a Slack channel',
                  }),
                },
              ]}
            >
              <Select
                placeholder={t('modal.selectSlackChannel', {
                  defaultValue: 'Select a Slack channel',
                })}
                showSearch
                optionFilterProp="children"
              >
                {availableChannels.map(channel => (
                  <Select.Option key={channel.id} value={channel.id}>
                    {channel.is_private && '🔒 '} #{channel.channel_name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="notificationTypes"
              label={t('modal.notificationTypes', { defaultValue: 'Notification Types' })}
              rules={[
                {
                  required: true,
                  message: t('validation.selectNotifications', {
                    defaultValue: 'Please select notification types',
                  }),
                },
              ]}
            >
              <Select
                mode="multiple"
                placeholder={t('modal.selectNotificationTypes', {
                  defaultValue: 'Select notification types',
                })}
                options={NOTIFICATION_OPTIONS}
              />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" block>
                {t('modal.addConfiguration', { defaultValue: 'Add Configuration' })}
              </Button>
            </Form.Item>
          </Form>
        </Modal>
      </>
    );
  }

  // Disconnected state - show centered card design
  return (
    <>
      {contextHolder}
      <Card
        className="min-h-[320px] text-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow duration-200"
        styles={{ body: { padding: '32px 24px' } }}
      >
        <div className="flex flex-col items-center justify-between h-full">
          {/* Icon */}
          <div className="text-6xl mb-6">
            <SlackIcon />
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col justify-center">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {t('title', { defaultValue: 'Connect Your Slack Workspace' })}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-8 max-w-sm mx-auto">
              {t('notConnected.description', {
                defaultValue:
                  'Integrate Slack with your Worklenz team to receive real-time notifications, create tasks from Slack, and keep your team synchronized across both platforms.',
              })}
            </p>
          </div>

          {/* Action Button */}
          <div className="w-full">
            <Button
              type="primary"
              size="large"
              onClick={handleConnect}
              loading={loading}
              className="w-full h-12 text-base font-medium bg-blue-500 hover:bg-blue-600 border-blue-500 hover:border-blue-600"
              aria-label={t('connectWorkspace')}
            >
              {t('connectWorkspace', { defaultValue: 'Connect Slack Workspace' })}
            </Button>
          </div>
        </div>
      </Card>
    </>
  );
}
