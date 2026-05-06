import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Form,
  Modal,
  Select,
  message,
  ReloadOutlined,
  theme,
  Alert,
  Space,
  Typography,
} from '@/shared/antd-imports';
import { slackApiService } from '@api/slack/slack.api.service';
import type { ISlackChannel } from '@api/slack/slack.api.service';
import logger from '@/utils/errorLogger';

interface SlackProjectQuickAddModalProps {
  open: boolean;
  projectId: string;
  projectName?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const NOTIFICATION_TYPE_DEFINITIONS = [
  {
    value: 'task_created',
    labelKey: 'notificationTypes.taskCreated',
    defaultValue: 'Task Created',
  },
  {
    value: 'task_assigned',
    labelKey: 'notificationTypes.taskAssigned',
    defaultValue: 'Task Assigned',
  },
  {
    value: 'status_changed',
    labelKey: 'notificationTypes.statusChanged',
    defaultValue: 'Status Changed',
  },
  {
    value: 'task_completed',
    labelKey: 'notificationTypes.taskCompleted',
    defaultValue: 'Task Completed',
  },
  {
    value: 'comment_added',
    labelKey: 'notificationTypes.commentAdded',
    defaultValue: 'Comment Added',
  },
  {
    value: 'due_date_changed',
    labelKey: 'notificationTypes.dueDateChanged',
    defaultValue: 'Due Date Changed',
  },
];

export const SlackProjectQuickAddModal: React.FC<SlackProjectQuickAddModalProps> = ({
  open,
  projectId,
  projectName,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation('project-integrations');
  const { token } = theme.useToken();
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const [availableChannels, setAvailableChannels] = useState<ISlackChannel[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { Text } = Typography;

  // Memoize notification options
  const notificationOptions = useMemo(
    () =>
      NOTIFICATION_TYPE_DEFINITIONS.map(({ value, labelKey, defaultValue }) => ({
        value,
        label: t(labelKey, { defaultValue }),
      })),
    [t]
  );

  // Memoize channel options
  const channelOptions = useMemo(
    () =>
      availableChannels.map(channel => ({
        value: channel.id,
        label: (
          <span>
            {channel.is_private && '🔒 '} #{channel.channel_name}
          </span>
        ),
      })),
    [availableChannels]
  );

  const loadAvailableChannels = async () => {
    try {
      const channels = await slackApiService.getAvailableChannels();
      setAvailableChannels(channels);
    } catch (error) {
      console.error('Failed to load available channels:', error);
      messageApi.error(t('errors.loadChannelsFailed', { defaultValue: 'Failed to load channels' }));
    }
  };

  const handleRefreshChannels = async () => {
    try {
      setRefreshing(true);
      await slackApiService.refreshChannels();
      await loadAvailableChannels();
    } catch (error) {
      logger.error('Failed to refresh channels', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSubmit = async (values: { slackChannelId: string; notificationTypes: string[] }) => {
    try {
      setSubmitting(true);
      await slackApiService.createChannelConfig({
        projectId,
        slackChannelId: values.slackChannelId,
        notificationTypes: values.notificationTypes,
        autoJoin: false,
      });
      messageApi.success(
        t('messages.integrationAdded', { defaultValue: 'Slack integration added successfully!' })
      );
      form.resetFields();
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Failed to add Slack integration:', error);
      messageApi.error(
        t('errors.addIntegrationFailed', { defaultValue: 'Failed to add integration' })
      );
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadAvailableChannels();
      // Set default notification types
      form.setFieldsValue({
        notificationTypes: ['task_created', 'task_assigned', 'status_changed'],
      });
    }
  }, [open, form]);

  return (
    <Modal
      title={t('slack.quickAddTitle', { defaultValue: 'Add Slack to Project' })}
      open={open}
      onCancel={onClose}
      footer={null}
      width={500}
      styles={{
        body: { padding: '24px' },
      }}
    >
      {contextHolder}
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        {projectName && (
          <Alert
            message={
              <Text>
                ℹ️ {t('slack.currentProject', { defaultValue: 'Project' })}:{' '}
                <Text strong>{projectName}</Text>
              </Text>
            }
            type="info"
            style={{ marginBottom: '16px' }}
          />
        )}

        <Form.Item
          name="slackChannelId"
          label={
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <span>{t('slack.selectChannel', { defaultValue: 'Slack Channel' })}</span>
              <Button
                type="link"
                size="small"
                icon={<ReloadOutlined />}
                onClick={handleRefreshChannels}
                loading={refreshing}
                style={{ padding: 0, height: 'auto' }}
              >
                {t('slack.refresh', { defaultValue: 'Refresh' })}
              </Button>
            </Space>
          }
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
            placeholder={t('slack.selectChannelPlaceholder', {
              defaultValue: 'Select a Slack channel...',
            })}
            showSearch
            optionFilterProp="children"
            options={channelOptions}
            filterOption={(input, option) => {
              const channelName =
                availableChannels.find(c => c.id === option?.value)?.channel_name || '';
              return channelName.toLowerCase().includes(input.toLowerCase());
            }}
          />
        </Form.Item>

        <Form.Item
          name="notificationTypes"
          label={t('slack.selectNotifications', { defaultValue: 'Notification Types' })}
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
            placeholder={t('slack.selectNotificationsPlaceholder', {
              defaultValue: 'Select notification types...',
            })}
            options={notificationOptions}
          />
        </Form.Item>

        <Alert
          message={
            <Text style={{ fontSize: '12px' }}>
              💡{' '}
              {t('slack.inviteBotTip', {
                defaultValue: 'Tip: Make sure to invite @Worklenz bot to your Slack channel first!',
              })}
            </Text>
          }
          type="warning"
          showIcon
          style={{ marginBottom: '16px' }}
        />

        <Form.Item style={{ marginBottom: 0 }}>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={onClose}>{t('cancel', { defaultValue: 'Cancel' })}</Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              {t('slack.addButton', { defaultValue: 'Add Integration' })}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};
