import { useTranslation } from 'react-i18next';
import { Badge, Button, CrownOutlined, Typography } from '@/shared/antd-imports';
import { SlackIcon } from '../IntegrationIcons';
import { IntegrationTile } from '../IntegrationTile';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';

interface SlackDisconnectedCardProps {
  loading: boolean;
  onConnect: () => void;
  hasBusinessAccess: boolean;
}

export function SlackDisconnectedCard({
  loading,
  onConnect,
  hasBusinessAccess,
}: SlackDisconnectedCardProps) {
  const { t } = useTranslation('settings/slack-integration');
  const dispatch = useAppDispatch();

  return (
    <IntegrationTile icon={<SlackIcon />} title={t('integrationName', { defaultValue: 'Slack' })}>
      <Badge
        status="default"
        text={t('center.notConnected', {
          ns: 'settings/integrations',
          defaultValue: 'Not connected',
        })}
      />
      <Typography.Paragraph style={{ margin: 0, flex: 1 }}>
        {t('notConnected.description', {
          defaultValue:
            'Integrate Slack with your Worklenz team to receive real-time notifications, create tasks from Slack, and keep your team synchronized across both platforms.',
        })}
      </Typography.Paragraph>
      {hasBusinessAccess ? (
        <Button
          type="primary"
          onClick={onConnect}
          loading={loading}
          style={{ alignSelf: 'flex-start' }}
        >
          {t('connect', { ns: 'settings/integrations', defaultValue: 'Connect' })}
        </Button>
      ) : (
        <Button
          style={{ alignSelf: 'flex-start' }}
          type="primary"
          onClick={() => dispatch(toggleUpgradeModal())}
          icon={<CrownOutlined />}
        >
          {t('upgradeRequired', { defaultValue: 'Upgrade to Business Plan' })}
        </Button>
      )}
    </IntegrationTile>
  );
}
