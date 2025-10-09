import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button, Card, Switch, Select, Table, Tag, Modal, Form, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  SlackOutlined,
  PlusOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
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

export function SlackIntegration() {
  const { t } = useTranslation('settings/slack-integration');
  const [messageApi, contextHolder] = message.useMessage();
  const [isConnected, setIsConnected] = useState(false);
  const [workspace, setWorkspace] = useState<{ id: string; name: string; team_id: string; is_active: boolean } | null>(null);
  const [channels, setChannels] = useState<ISlackChannelConfig[]>([]);
  const [availableChannels, setAvailableChannels] = useState<ISlackChannel[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm<ChannelFormValues>();

  useEffect(() => {
    const initialize = async () => {
      await Promise.all([
        checkSlackConnection(),
        loadChannelConfigurations(),
        loadProjects(),
      ]);

      // Check for OAuth callback params
      const params = new URLSearchParams(window.location.search);
      const slackStatus = params.get('slack');

      if (slackStatus === 'success') {
        messageApi.success(t('messages.connectedSuccess'));
        window.history.replaceState({}, '', window.location.pathname);
        await checkSlackConnection();
      } else if (slackStatus === 'error') {
        messageApi.error(t('errors.connectionFailed'));
        window.history.replaceState({}, '', window.location.pathname);
      } else if (slackStatus === 'cancelled') {
        messageApi.info(t('messages.installationCancelled'));
        window.history.replaceState({}, '', window.location.pathname);
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

      // Check if window was closed
      const checkInterval = setInterval(() => {
        if (authWindow?.closed) {
          clearInterval(checkInterval);
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

  const handleAddChannel = useCallback(async (values: ChannelFormValues) => {
    try {
      await slackApiService.createChannelConfig(values);
      messageApi.success(t('messages.configAdded'));
      setModalVisible(false);
      form.resetFields();
      await loadChannelConfigurations();
    } catch (error) {
      console.error('Failed to add channel configuration:', error);
      messageApi.error(t('errors.addConfigFailed'));
    }
  }, [form, loadChannelConfigurations, messageApi, t]);

  const handleToggleChannel = useCallback(async (channelId: string, isActive: boolean) => {
    try {
      await slackApiService.updateChannelConfig(channelId, { isActive });
      messageApi.success(t('messages.statusUpdated'));
      await loadChannelConfigurations();
    } catch (error) {
      console.error('Failed to update channel status:', error);
      messageApi.error(t('errors.updateStatusFailed'));
    }
  }, [loadChannelConfigurations, messageApi, t]);

  const handleDeleteChannel = useCallback(async (channelId: string) => {
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
  }, [loadChannelConfigurations, messageApi, t]);

  // Memoized table columns
  const columns: ColumnsType<ISlackChannelConfig> = useMemo(() => [
    {
      title: t('table.project'),
      dataIndex: 'projectName',
      key: 'projectName',
    },
    {
      title: t('table.slackChannel'),
      dataIndex: 'slackChannelName',
      key: 'slackChannelName',
      render: (text: string) => <Tag icon={<SlackIcon />}>{text}</Tag>,
    },
    {
      title: t('table.notifications'),
      dataIndex: 'notificationTypes',
      key: 'notificationTypes',
      render: (types: string[] | undefined | null) => (
        <>
          {(types ?? []).map(type => (
            <Tag key={type}>{type.replace(/_/g, ' ')}</Tag>
          ))}
        </>
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
  ], [t, handleToggleChannel, handleDeleteChannel]);

  if (isConnected) {
    // Connected state - show full management interface
    return (
      <>
        {contextHolder}
        <Card
          className="min-h-[320px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
          extra={
            <div className="flex gap-2">
              <Button
                icon={<PlusOutlined />}
                onClick={() => setModalVisible(true)}
                aria-label={t('addChannelConfig')}
              >
                {t('addChannelConfig')}
              </Button>
              <Button danger onClick={handleDisconnect} aria-label={t('disconnect.okText')}>
                {t('disconnect.okText')}
              </Button>
            </div>
          }
        >
          <div className="flex items-start gap-4 mb-4">
            <div className="text-4xl text-green-500 mt-1">
              <CheckCircleOutlined />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-semibold dark:text-gray-200 m-0">{t('title')}</h3>
                <Tag color="success">{t('status.connected')}</Tag>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-0">
                {workspace?.name && `Connected to ${workspace.name}`}
              </p>
            </div>
          </div>

          <Table
            columns={columns}
            dataSource={channels}
            rowKey="id"
            loading={loading}
            aria-label={t('table.channelConfigs')}
            size="small"
          />

          <Modal
            title={t('modal.configureChannel')}
            open={modalVisible}
            onCancel={() => setModalVisible(false)}
            footer={null}
            aria-labelledby="slack-channel-config-modal"
          >
            <Form form={form} layout="vertical" onFinish={handleAddChannel}>
              <Form.Item
                name="projectId"
                label={t('modal.project')}
                rules={[{ required: true, message: t('validation.selectProject') }]}
              >
                <Select
                  placeholder={t('modal.selectProject')}
                  showSearch
                  optionFilterProp="children"
                  aria-label={t('modal.project')}
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
                label={t('modal.slackChannel')}
                rules={[{ required: true, message: t('validation.selectChannel') }]}
              >
                <Select
                  placeholder={t('modal.selectSlackChannel')}
                  showSearch
                  optionFilterProp="children"
                  aria-label={t('modal.slackChannel')}
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
                label={t('modal.notificationTypes')}
                rules={[{ required: true, message: t('validation.selectNotifications') }]}
              >
                <Select
                  mode="multiple"
                  placeholder={t('modal.selectNotificationTypes')}
                  options={NOTIFICATION_OPTIONS}
                  aria-label={t('modal.notificationTypes')}
                />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" block>
                  {t('modal.addConfiguration')}
                </Button>
              </Form.Item>
            </Form>
          </Modal>
        </Card>
      </>
    );
  }

  // Disconnected state - show centered card design matching the image
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
                defaultValue: 'Integrate Slack with your Worklenz team to receive real-time notifications, create tasks from Slack, and keep your team synchronized across both platforms.'
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
