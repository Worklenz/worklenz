import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Form, Input, List, Modal, Popconfirm, Select, Switch, Tag, Tooltip, Typography, message } from 'antd';
import { DeleteOutlined, SendOutlined } from '@ant-design/icons';
import {
  teamsWebhooksApiService,
  type ITeamsWebhook,
} from '@/api/teams-webhooks/teams-webhooks.api.service';
import { decodeHtmlEntities } from '@/utils/html-entities';
import { NOTIFICATION_TYPE_DEFINITIONS } from './SlackProjectQuickAddModal';

interface TeamsProjectModalProps {
  open: boolean;
  projectId: string;
  projectName?: string;
  onClose: () => void;
  /** Called after a webhook is added, removed or toggled so callers can refresh their counts. */
  onChange?: () => void;
}

const DEFAULT_NOTIFICATION_TYPES = ['task_created', 'task_assigned', 'status_changed'];

export const TeamsProjectModal: React.FC<TeamsProjectModalProps> = ({
  open,
  projectId,
  projectName,
  onClose,
  onChange,
}) => {
  const { t } = useTranslation('project-integrations');
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const [webhooks, setWebhooks] = useState<ITeamsWebhook[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const notificationOptions = useMemo(
    () =>
      NOTIFICATION_TYPE_DEFINITIONS.map(({ value, labelKey, defaultValue }) => ({
        value,
        label: t(labelKey, { defaultValue }),
      })),
    [t]
  );

  const loadWebhooks = useCallback(async () => {
    try {
      setLoading(true);
      const response = await teamsWebhooksApiService.getProjectWebhooks(projectId);
      setWebhooks(response.body || []);
    } catch {
      messageApi.error(t('teams.errors.load', { defaultValue: 'Failed to load Teams webhooks' }));
    } finally {
      setLoading(false);
    }
  }, [projectId, messageApi, t]);

  useEffect(() => {
    if (!open) return;
    loadWebhooks();
    form.setFieldsValue({ notificationTypes: DEFAULT_NOTIFICATION_TYPES });
  }, [open, loadWebhooks, form]);

  const handleAdd = async (values: { name: string; webhookUrl: string; notificationTypes: string[] }) => {
    try {
      setSubmitting(true);
      await teamsWebhooksApiService.createWebhook({ projectId, ...values });
      messageApi.success(t('teams.messages.added', { defaultValue: 'Teams webhook added' }));
      form.resetFields();
      form.setFieldsValue({ notificationTypes: DEFAULT_NOTIFICATION_TYPES });
      await loadWebhooks();
      onChange?.();
    } catch (error: any) {
      // The API explains why a URL was rejected (not https, not a Teams host, ...).
      messageApi.error(
        error?.response?.data?.message ||
          t('teams.errors.add', { defaultValue: 'Failed to add Teams webhook' })
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (webhook: ITeamsWebhook, isActive: boolean) => {
    try {
      await teamsWebhooksApiService.updateWebhook(webhook.id, { isActive });
      await loadWebhooks();
      onChange?.();
    } catch {
      messageApi.error(t('teams.errors.update', { defaultValue: 'Failed to update Teams webhook' }));
    }
  };

  const handleDelete = async (webhook: ITeamsWebhook) => {
    try {
      await teamsWebhooksApiService.deleteWebhook(webhook.id);
      await loadWebhooks();
      onChange?.();
    } catch {
      messageApi.error(t('teams.errors.delete', { defaultValue: 'Failed to remove Teams webhook' }));
    }
  };

  const handleTest = async (webhook: ITeamsWebhook) => {
    try {
      setTestingId(webhook.id);
      await teamsWebhooksApiService.sendTest(webhook.id);
      messageApi.success(t('teams.messages.testSent', { defaultValue: 'Test message sent to Teams' }));
    } catch (error: any) {
      messageApi.error(
        error?.response?.data?.message ||
          t('teams.errors.test', { defaultValue: 'Failed to send test message' })
      );
    } finally {
      setTestingId(null);
      loadWebhooks();
    }
  };

  return (
    <Modal
      title={t('teams.modalTitle', { defaultValue: 'Microsoft Teams' })}
      open={open}
      onCancel={onClose}
      footer={null}
      width={560}
    >
      {contextHolder}
      {projectName && (
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          {t('slack.currentProject', { defaultValue: 'Project' })}:{' '}
          <Typography.Text strong>{decodeHtmlEntities(projectName)}</Typography.Text>
        </Typography.Paragraph>
      )}

      <List
        size="small"
        loading={loading}
        dataSource={webhooks}
        locale={{ emptyText: t('teams.empty', { defaultValue: 'No Teams channels connected yet' }) }}
        style={{ marginBottom: 16 }}
        renderItem={webhook => (
          <List.Item
            actions={[
              <Tooltip key="test" title={t('teams.sendTest', { defaultValue: 'Send test message' })}>
                <Button
                  size="small"
                  icon={<SendOutlined />}
                  loading={testingId === webhook.id}
                  disabled={!webhook.is_active}
                  onClick={() => handleTest(webhook)}
                />
              </Tooltip>,
              <Switch
                key="active"
                size="small"
                checked={webhook.is_active}
                onChange={checked => handleToggle(webhook, checked)}
              />,
              <Popconfirm
                key="delete"
                title={t('teams.confirmDelete', { defaultValue: 'Remove this Teams webhook?' })}
                onConfirm={() => handleDelete(webhook)}
              >
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>,
            ]}
          >
            <List.Item.Meta
              title={
                <>
                  {webhook.name}{' '}
                  {webhook.last_error && (
                    <Tooltip title={webhook.last_error}>
                      <Tag color="error" style={{ marginLeft: 4 }}>
                        {t('teams.deliveryFailed', { defaultValue: 'Delivery failed' })}
                      </Tag>
                    </Tooltip>
                  )}
                </>
              }
              description={webhook.notification_types
                .map(type => {
                  const def = NOTIFICATION_TYPE_DEFINITIONS.find(d => d.value === type);
                  return def ? t(def.labelKey, { defaultValue: def.defaultValue }) : type;
                })
                .join(', ')}
            />
          </List.Item>
        )}
      />

      <Typography.Title level={5} style={{ marginTop: 0 }}>
        {t('teams.addTitle', { defaultValue: 'Add a Teams channel' })}
      </Typography.Title>
      <Form form={form} layout="vertical" onFinish={handleAdd}>
        <Form.Item
          name="name"
          label={t('teams.name', { defaultValue: 'Name' })}
          rules={[
            { required: true, message: t('teams.validation.name', { defaultValue: 'Please enter a name' }) },
            { max: 100 },
          ]}
        >
          <Input placeholder={t('teams.namePlaceholder', { defaultValue: 'e.g. Engineering channel' })} />
        </Form.Item>
        <Form.Item
          name="webhookUrl"
          label={t('teams.webhookUrl', { defaultValue: 'Webhook URL' })}
          rules={[
            { required: true, message: t('teams.validation.url', { defaultValue: 'Please paste the webhook URL' }) },
          ]}
          extra={t('teams.webhookHelp', {
            defaultValue:
              'In Teams, open the channel menu (…) → Workflows → "Send webhook alerts to a channel", then paste the webhook URL it gives you.',
          })}
        >
          <Input.Password placeholder="https://…logic.azure.com/…" autoComplete="off" />
        </Form.Item>
        <Form.Item
          name="notificationTypes"
          label={t('slack.selectNotifications', { defaultValue: 'Notification Types' })}
          rules={[
            {
              required: true,
              message: t('validation.selectNotifications', {
                defaultValue: 'Please select at least one notification type',
              }),
            },
          ]}
        >
          <Select mode="multiple" options={notificationOptions} />
        </Form.Item>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('teams.secretNote', {
            defaultValue: 'The webhook URL is stored encrypted and is not shown again after saving.',
          })}
          description={t('teams.ownerNote', {
            defaultValue:
              'The webhook runs as a Teams workflow owned by the person who created it. If that person leaves, it stops working, so add a co-owner in the Workflows app. Teams does not fully support posting to private channels yet.',
          })}
        />
        <Button type="primary" htmlType="submit" loading={submitting} block>
          {t('teams.addButton', { defaultValue: 'Add Teams channel' })}
        </Button>
      </Form>
    </Modal>
  );
};
