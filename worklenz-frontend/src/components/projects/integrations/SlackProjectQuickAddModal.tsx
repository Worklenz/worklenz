import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Form, Modal, Select, message, ReloadOutlined } from '@/shared/antd-imports';
import { slackApiService } from '@api/slack/slack.api.service';
import type { ISlackChannel } from '@api/slack/slack.api.service';

interface SlackProjectQuickAddModalProps {
  open: boolean;
  projectId: string;
  projectName?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const NOTIFICATION_TYPE_DEFINITIONS = [
  { value: 'task_created', labelKey: 'notificationTypes.taskCreated', defaultValue: 'Task Created' },
  { value: 'task_assigned', labelKey: 'notificationTypes.taskAssigned', defaultValue: 'Task Assigned' },
  { value: 'status_changed', labelKey: 'notificationTypes.statusChanged', defaultValue: 'Status Changed' },
  { value: 'task_completed', labelKey: 'notificationTypes.taskCompleted', defaultValue: 'Task Completed' },
  { value: 'comment_added', labelKey: 'notificationTypes.commentAdded', defaultValue: 'Comment Added' },
  { value: 'due_date_changed', labelKey: 'notificationTypes.dueDateChanged', defaultValue: 'Due Date Changed' },
];

export const SlackProjectQuickAddModal: React.FC<SlackProjectQuickAddModalProps> = ({
  open,
  projectId,
  projectName,
  onClose,
  onSuccess
}) => {
  const { t } = useTranslation('project-integrations');
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const [availableChannels, setAvailableChannels] = useState<ISlackChannel[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const notificationOptions = NOTIFICATION_TYPE_DEFINITIONS.map(({ value, labelKey, defaultValue }) => ({
    value,
    label: t(labelKey, { defaultValue }),
  }));

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
      messageApi.success(t('messages.channelsRefreshed', { defaultValue: 'Channels refreshed successfully' }));
    } catch (error) {
      console.error('Failed to refresh channels:', error);
      messageApi.error(t('errors.refreshChannelsFailed', { defaultValue: 'Failed to refresh channels' }));
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
        autoJoin: false
      });
      messageApi.success(t('messages.integrationAdded', { defaultValue: 'Slack integration added successfully!' }));
      form.resetFields();
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Failed to add Slack integration:', error);
      messageApi.error(t('errors.addIntegrationFailed', { defaultValue: 'Failed to add integration' }));
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadAvailableChannels();
      // Set default notification types
      form.setFieldsValue({
        notificationTypes: ['task_created', 'task_assigned', 'status_changed']
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
    >
      {contextHolder}
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        {projectName && (
          <div
            style={{
              padding: '12px',
              backgroundColor: 'var(--info-bg, #e6f7ff)',
              borderRadius: '6px',
              marginBottom: '16px',
              fontSize: '13px'
            }}
          >
            ℹ️ {t('slack.currentProject', { defaultValue: 'Project' })}: <strong>{projectName}</strong>
          </div>
        )}

        <Form.Item
          name="slackChannelId"
          label={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span>{t('slack.selectChannel', { defaultValue: 'Slack Channel' })}</span>
              <Button
                type="link"
                size="small"
                icon={<ReloadOutlined />}
                onClick={handleRefreshChannels}
                loading={refreshing}
                style={{ padding: 0, height: 'auto', marginLeft: 'auto' }}
              >
                {t('slack.refresh', { defaultValue: 'Refresh' })}
              </Button>
            </div>
          }
          rules={[
            {
              required: true,
              message: t('validation.selectChannel', { defaultValue: 'Please select a Slack channel' }),
            },
          ]}
        >
          <Select
            placeholder={t('slack.selectChannelPlaceholder', { defaultValue: 'Select a Slack channel...' })}
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
          label={t('slack.selectNotifications', { defaultValue: 'Notification Types' })}
          rules={[
            {
              required: true,
              message: t('validation.selectNotifications', { defaultValue: 'Please select notification types' }),
            },
          ]}
        >
          <Select
            mode="multiple"
            placeholder={t('slack.selectNotificationsPlaceholder', { defaultValue: 'Select notification types...' })}
            options={notificationOptions}
          />
        </Form.Item>

        <div
          style={{
            padding: '12px',
            backgroundColor: 'var(--warning-bg, #fffbe6)',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '12px',
            lineHeight: 1.5
          }}
        >
          💡 {t('slack.inviteBotTip', { defaultValue: 'Tip: Make sure to invite @Worklenz bot to your Slack channel first!' })}
        </div>

        <Form.Item style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={onClose}>
              {t('cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              {t('slack.addButton', { defaultValue: 'Add Integration' })}
            </Button>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
};
