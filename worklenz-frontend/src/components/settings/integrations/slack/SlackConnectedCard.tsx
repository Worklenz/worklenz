import { useTranslation } from 'react-i18next';
import { Button, Flex, Tag, Typography } from '@/shared/antd-imports';
import { SlackIcon } from '../IntegrationIcons';
import { IntegrationTile } from '../IntegrationTile';
import type { ISlackChannelConfig } from '@/api/slack/slack.api.service';

interface SlackConnectedCardProps {
  workspace: { id: string; name: string; team_id: string; is_active: boolean } | null;
  channels: ISlackChannelConfig[];
  availableChannels: { id: string; channel_name: string }[];
  onManage: () => void;
  onDisconnect: () => void;
}

export function SlackConnectedCard({
  workspace,
  channels,
  availableChannels,
  onManage,
  onDisconnect,
}: SlackConnectedCardProps) {
  const { t } = useTranslation('settings/slack-integration');
  const activeChannels = channels.filter(channel => channel.isActive);

  return (
    <IntegrationTile
      icon={<SlackIcon />}
      title={t('integrationName', { defaultValue: 'Slack' })}
      extra={<Tag color="success">{t('status.connected', { defaultValue: 'Connected' })}</Tag>}
    >
      <Typography.Text strong>
        {workspace?.name || t('defaultWorkspaceName', { defaultValue: 'Slack Workspace' })}
      </Typography.Text>
      <Typography.Text type="secondary">
        {t('connectedDescription', {
          defaultValue:
            "Your team's Slack workspace is connected. Configure which channels receive notifications for each project.",
        })}
      </Typography.Text>
      <Flex gap={12} wrap="wrap">
        <Typography.Text type="secondary">
          {t('stats.total', { defaultValue: 'Total' })}: {channels.length}
        </Typography.Text>
        <Typography.Text type="secondary">
          {t('stats.active', { defaultValue: 'Active' })}: {activeChannels.length}
        </Typography.Text>
        <Typography.Text type="secondary">
          {t('stats.available', { defaultValue: 'Available' })}: {availableChannels.length}
        </Typography.Text>
      </Flex>
      <Flex gap={8} wrap="wrap">
        <Button type="primary" onClick={onManage}>
          {t('manageConfigurations', { defaultValue: 'Manage' })}
        </Button>
        <Button danger type="text" onClick={onDisconnect}>
          {t('disconnect.okText', { defaultValue: 'Disconnect' })}
        </Button>
      </Flex>
    </IntegrationTile>
  );
}
