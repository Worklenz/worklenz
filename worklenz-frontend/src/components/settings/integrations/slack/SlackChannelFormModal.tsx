import { useTranslation } from 'react-i18next';
import { Button, Form, Modal, Select } from '@/shared/antd-imports';
import type { FormInstance } from '@/shared/antd-imports';
import type { ISlackChannelConfig, ISlackChannel } from '@api/slack/slack.api.service';

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
}

const NOTIFICATION_OPTIONS = [
  { value: 'task_created', label: 'Task Created' },
  { value: 'task_completed', label: 'Task Completed' },
  { value: 'task_assigned', label: 'Task Assigned' },
  { value: 'comment_added', label: 'Comment Added' },
  { value: 'due_date_reminder', label: 'Due Date Reminder' },
];

export function SlackChannelFormModal({
  open,
  form,
  editingChannel,
  projects,
  availableChannels,
  onClose,
  onSubmit,
}: SlackChannelFormModalProps) {
  const { t } = useTranslation('settings/slack-integration');

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
            options={NOTIFICATION_OPTIONS}
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
