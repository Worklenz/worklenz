import { Button, Card, Form, Input, Space, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { discordApiService, DiscordConfig } from '@/api/discord/discord.api.service';

export const DiscordIntegration = () => {
  const { t } = useTranslation('settings/discord-integration');
  const [config, setConfig] = useState<DiscordConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const loadConfig = async () => {
    setLoading(true);
    try {
      const current = await discordApiService.getConfig();
      setConfig(current);
      if (current) form.setFieldsValue({ guildId: current.guild_id });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadConfig();
  }, []);

  const save = async (values: { webhookUrl: string; guildId: string }) => {
    setSaving(true);
    try {
      await discordApiService.saveConfig({
        ...values,
        notificationTypes: ['task_assigned', 'status_changed', 'task_completed', 'comment_added'],
      });
      message.success(t('saved', { defaultValue: 'Discord integration saved' }));
      await loadConfig();
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async () => {
    await discordApiService.deleteConfig();
    setConfig(null);
    form.resetFields();
    message.success(t('disconnected', { defaultValue: 'Discord integration disconnected' }));
  };

  if (loading) return <Card loading />;

  return (
    <Card>
      <Space direction="vertical" size="middle" className="w-full">
        <Typography.Paragraph>
          {t('description', {
            defaultValue:
              'Send task assignments, status changes, completions, and comments to a Discord channel. Configure the Worklenz comment command to reply from Discord.',
          })}
        </Typography.Paragraph>
        <Form form={form} layout="vertical" onFinish={save}>
          <Form.Item
            name="webhookUrl"
            label={t('webhookUrl', { defaultValue: 'Discord webhook URL' })}
            rules={[{ required: !config, type: 'url' }]}
          >
            <Input.Password placeholder={config ? t('leaveBlank', { defaultValue: 'Leave blank to keep the current webhook' }) : undefined} />
          </Form.Item>
          <Form.Item
            name="guildId"
            label={t('guildId', { defaultValue: 'Discord server ID' })}
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={saving}>
              {t('save', { defaultValue: 'Save' })}
            </Button>
            {config && <Button danger onClick={disconnect}>{t('disconnect', { defaultValue: 'Disconnect' })}</Button>}
          </Space>
        </Form>
        <Typography.Text type="secondary">
          {t('commandHelp', { defaultValue: 'Users linked by an administrator can comment with /worklenz-comment task_id:<task UUID> comment:<text>.' })}
        </Typography.Text>
      </Space>
    </Card>
  );
};
