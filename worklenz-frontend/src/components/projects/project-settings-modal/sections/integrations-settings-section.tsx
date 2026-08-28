import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Flex, Typography, TeamOutlined, theme, message } from '@/shared/antd-imports';
import { GithubOutlined } from '@ant-design/icons';
import { IntegrationItem } from '@/components/projects/integrations/IntegrationItem';
import { SlackIcon } from '@/components/settings/integrations/IntegrationIcons';
import { SlackProjectQuickAddModal } from '@/ee/components/projects/integrations/SlackProjectQuickAddModal';
import { slackApiService } from '@/ee/api/slack/slack.api.service';
import { useAuthService } from '@/hooks/useAuth';
import { hasBusinessFeatureAccess } from '@/ee/utils/subscription-utils';
import type { ProjectIntegrationStatus } from '@/components/projects/integrations/integrations.types';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { showUpgradePrompt } from '@/features/admin-center/admin-center.slice';

interface IntegrationsSettingsSectionProps {
  projectId?: string | null;
  projectName?: string;
}

const IntegrationsSettingsSection = ({
  projectId,
  projectName,
}: IntegrationsSettingsSectionProps) => {
  const { t } = useTranslation('project-drawer');
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();
  const authService = useAuthService();
  const currentSession = useMemo(() => authService.getCurrentSession(), [authService]);
  const hasBusinessAccess = useMemo(() => hasBusinessFeatureAccess(currentSession), [currentSession]);

  const [integrationStatus, setIntegrationStatus] = useState<ProjectIntegrationStatus | null>(null);
  const [slackModalOpen, setSlackModalOpen] = useState(false);

  const fetchIntegrationStatus = useCallback(async () => {
    if (!projectId || !hasBusinessAccess) return;

    try {
      const [slackWorkspace, slackConfigsResponse] = await Promise.all([
        slackApiService.getStatus().catch(() => null),
        slackApiService.getProjectChannelConfigs(projectId).catch(() => null),
      ]);

      const slackChannels = slackConfigsResponse?.body || [];
      const activeSlackChannels = Array.isArray(slackChannels)
        ? slackChannels.filter((ch: any) => ch.isActive)
        : [];

      setIntegrationStatus({
        slack: {
          connected: !!slackWorkspace?.connected,
          workspaceConnected: !!slackWorkspace?.connected,
          channelCount: activeSlackChannels.length,
          channels: activeSlackChannels.map((ch: any) => ({
            id: ch.id,
            name: ch.slackChannelName || ch.channel_name || 'Unknown',
            isActive: ch.isActive,
          })),
        },
        teams: { connected: false, tenantConnected: false, channelCount: 0 },
        github: { connected: false, accountConnected: false, repositoryCount: 0 },
      });
    } catch (error) {
      console.error('Failed to fetch integration status:', error);
    }
  }, [projectId, hasBusinessAccess]);

  useEffect(() => {
    if (projectId) {
      fetchIntegrationStatus();
    }
  }, [projectId, fetchIntegrationStatus]);

  const handleUpgradeClick = useCallback(() => {
    dispatch(
      showUpgradePrompt({
        title: 'Integrations',
        description:
          'Connect Slack, Teams, and GitHub to your projects. Available on the Business plan.',
      })
    );
  }, [dispatch]);

  const handleSlackClick = () => {
    if (!hasBusinessAccess) {
      handleUpgradeClick();
      return;
    }
    if (!integrationStatus?.slack?.workspaceConnected) {
      message.warning(
        t('slackNotConnected', {
          defaultValue: 'Please connect your Slack workspace in Settings first',
        })
      );
      return;
    }
    setSlackModalOpen(true);
  };

  return (
    <Flex vertical gap={16}>
      <div>
        <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 4 }}>
          {t('integrationsSectionTitle', { defaultValue: 'Integrations' })}
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
          {t('integrationsSectionDescription', {
            defaultValue: 'Connect this project to external tools like Slack.',
          })}
        </Typography.Paragraph>
      </div>

      <div
        style={{
          borderRadius: 10,
          border: `1px solid ${token.colorBorderSecondary}`,
          overflow: 'hidden',
        }}
      >
        <IntegrationItem
          icon={<SlackIcon />}
          title={t('slackTitle', { defaultValue: 'Slack' })}
          description={t('slackDescription', {
            defaultValue: 'Send notifications to Slack channels',
          })}
          badge={integrationStatus?.slack?.channelCount}
          channels={integrationStatus?.slack?.channels?.map(ch => `#${ch.name}`)}
          locked={!hasBusinessAccess}
          onClick={handleSlackClick}
        />
        <IntegrationItem
          icon={<TeamOutlined style={{ color: '#6264A7' }} />}
          title={t('teamsTitle', { defaultValue: 'Microsoft Teams' })}
          description={t('teamsDescription', {
            defaultValue: 'Send notifications to Teams channels',
          })}
          comingSoon
        />
        <IntegrationItem
          icon={<GithubOutlined style={{ color: '#24292e' }} />}
          title={t('githubTitle', { defaultValue: 'GitHub' })}
          description={t('githubDescription', { defaultValue: 'Sync tasks with GitHub issues' })}
          comingSoon
        />
      </div>

      {projectId && (
        <SlackProjectQuickAddModal
          open={slackModalOpen}
          projectId={projectId}
          projectName={projectName}
          onClose={() => setSlackModalOpen(false)}
          onSuccess={() => fetchIntegrationStatus()}
        />
      )}
    </Flex>
  );
};

export default IntegrationsSettingsSection;
