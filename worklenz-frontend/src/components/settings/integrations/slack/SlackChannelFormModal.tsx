import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Form, Modal, Select, message, ReloadOutlined } from '@/shared/antd-imports';
import type { FormInstance } from '@/shared/antd-imports';
import type { ISlackChannelConfig, ISlackChannel } from '@api/slack/slack.api.service';
import { slackApiService } from '@api/slack/slack.api.service';

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

interface SlackChannelFormModalProps {
  open: boolean;
  form: FormInstance<ChannelFormValues>;
  editingChannel: ISlackChannelConfig | null;
  projects: Project[];
  availableChannels: ISlackChannel[];
  onClose: () => void;
  onSubmit: (values: ChannelFormValues) => void;
  onRefreshChannels: () => Promise<void>;
}

const NOTIFICATION_TYPE_DEFINITIONS = [
  {
    value: 'task_created',
    labelKey: 'modal.notificationOptions.taskCreated',
    defaultValue: 'Task Created',
  },
  {
    value: 'task_updated',
    labelKey: 'modal.notificationOptions.taskUpdated',
    defaultValue: 'Task Updated',
  },
  {
    value: 'task_completed',
    labelKey: 'modal.notificationOptions.taskCompleted',
    defaultValue: 'Task Completed',
  },
  {
    value: 'task_assigned',
    labelKey: 'modal.notificationOptions.taskAssigned',
    defaultValue: 'Task Assigned',
  },
  {
    value: 'comment_added',
    labelKey: 'modal.notificationOptions.commentAdded',
    defaultValue: 'Comment Added',
  },
  {
    value: 'status_changed',
    labelKey: 'modal.notificationOptions.statusChanged',
    defaultValue: 'Status Changed',
  },
  {
    value: 'due_date_changed',
    labelKey: 'modal.notificationOptions.dueDateChanged',
    defaultValue: 'Due Date Changed',
  },
  {
    value: 'assignee_changed',
    labelKey: 'modal.notificationOptions.assigneeChanged',
    defaultValue: 'Assignee Changed',
  },
  {
    value: 'priority_changed',
    labelKey: 'modal.notificationOptions.priorityChanged',
    defaultValue: 'Priority Changed',
  },
];

export function SlackChannelFormModal({
  open,
  form,
  editingChannel,
  projects,
  availableChannels,
  onClose,
  onSubmit,
  onRefreshChannels,
}: SlackChannelFormModalProps) {
  const { t } = useTranslation('settings/slack-integration');
  const [messageApi, contextHolder] = message.useMessage();
  const [refreshing, setRefreshing] = useState(false);
  
  const notificationOptions = NOTIFICATION_TYPE_DEFINITIONS.map(({ value, labelKey, defaultValue }) => ({
    value,
    label: t(labelKey, { defaultValue }),
  }));

  const handleRefreshChannels = async () => {
    try {
      setRefreshing(true);
      await slackApiService.refreshChannels();
      await onRefreshChannels();
      messageApi.success(t('messages.channelsRefreshed', { defaultValue: 'Channels refreshed successfully' }));
    } catch (error) {
      console.error('Failed to refresh channels:', error);
      messageApi.error(t('errors.refreshChannelsFailed', { defaultValue: 'Failed to refresh channels' }));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Modal
      title={
        editingChannel
          ? t('modal.editChannel', { defaultValue: 'Edit Slack Channel' })
          : t('modal.configureChannel', { defaultValue: 'Configure Slack Channel' })
      }
      open={open}
      onCancel={onClose}
      footer={null}
    >
      {contextHolder}
      <Form form={form} layout="vertical" onFinish={onSubmit}>
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
            disabled={!!editingChannel}
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
          label={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span>{t('modal.slackChannel', { defaultValue: 'Slack Channel' })}</span>
              <Button
                type="link"
                size="small"
                icon={<ReloadOutlined />}
                onClick={handleRefreshChannels}
                loading={refreshing}
                style={{ padding: 0, height: 'auto', marginLeft: 'auto' }}
              >
                {t('modal.refreshChannels', { defaultValue: 'Refresh' })}
              </Button>
            </div>
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
            placeholder={t('modal.selectSlackChannel', {
              defaultValue: 'Select a Slack channel',
            })}
            showSearch
            optionFilterProp="children"
            disabled={!!editingChannel}
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
            options={notificationOptions}
          />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" block>
            {editingChannel
              ? t('modal.updateConfiguration', { defaultValue: 'Update Configuration' })
              : t('modal.addConfiguration', { defaultValue: 'Add Configuration' })}
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}
