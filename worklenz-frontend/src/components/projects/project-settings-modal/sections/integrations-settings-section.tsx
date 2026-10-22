import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Flex, Typography, theme, message } from '@/shared/antd-imports';
import { GithubOutlined } from '@ant-design/icons';
import { GithubProjectRepositories } from '@/components/github/GithubProjectRepositories';
import { useProjectPermissions } from '@/hooks/useProjectPermissions';
import { isSoftwareProjectType } from '@/lib/project/software-project';
import { useAppSelector } from '@/hooks/useAppSelector';
import { IntegrationItem } from '@/components/projects/integrations/IntegrationItem';
import { MSTeamsIcon, SlackIcon } from '@/components/settings/integrations/IntegrationIcons';
import { SlackProjectQuickAddModal } from '@/components/projects/integrations/SlackProjectQuickAddModal';
import { TeamsProjectModal } from '@/components/projects/integrations/TeamsProjectModal';
import { teamsWebhooksApiService } from '@/api/teams-webhooks/teams-webhooks.api.service';
import { slackApiService } from '@/api/slack/slack.api.service';
import { useAuthService } from '@/hooks/useAuth';
import { hasBusinessFeatureAccess } from '@/utils/subscription-utils';
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
  const hasBusinessAccess = useMemo(
    () => hasBusinessFeatureAccess(currentSession),
    [currentSession]
  );

  const projectType = useAppSelector(state => state.projectDrawerReducer.project?.project_type);
  const projectKey = useAppSelector(state => state.projectDrawerReducer.project?.key);
  const { permissions } = useProjectPermissions(projectId ?? null);
  const isSoftwareProject = isSoftwareProjectType(projectType);

  const [integrationStatus, setIntegrationStatus] = useState<ProjectIntegrationStatus | null>(null);
  const [slackModalOpen, setSlackModalOpen] = useState(false);
  const [teamsModalOpen, setTeamsModalOpen] = useState(false);

  const fetchIntegrationStatus = useCallback(async () => {
    if (!projectId || !hasBusinessAccess) return;

    try {
      const [slackWorkspace, slackConfigsResponse, teamsResponse] = await Promise.all([
        slackApiService.getStatus().catch(() => null),
        slackApiService.getProjectChannelConfigs(projectId).catch(() => null),
        teamsWebhooksApiService.getProjectWebhooks(projectId).catch(() => null),
      ]);
      const activeTeamsWebhooks = (teamsResponse?.body || []).filter(webhook => webhook.is_active);

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
        teams: {
          connected: activeTeamsWebhooks.length > 0,
          channelCount: activeTeamsWebhooks.length,
          channels: activeTeamsWebhooks.map(webhook => webhook.name),
        },
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

  const handleTeamsClick = () => {
    if (!hasBusinessAccess) {
      handleUpgradeClick();
      return;
    }
    setTeamsModalOpen(true);
  };

  return (
    <Flex vertical gap={16}>
      <div>
        <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 4 }}>
          {t('integrationsSectionTitle', { defaultValue: 'Integrations' })}
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
          {t('integrationsSectionDescription', {
            defaultValue: 'Connect this project to external tools like Slack and GitHub.',
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
            defaultValue: 'Get task, status and comment updates in your Slack channels',
          })}
          badge={integrationStatus?.slack?.channelCount}
          channels={integrationStatus?.slack?.channels?.map(ch => `#${ch.name}`)}
          locked={!hasBusinessAccess}
          onClick={handleSlackClick}
        />
      </div>

      {projectId && isSoftwareProject ? (
        <GithubProjectRepositories
          projectId={projectId}
          projectKey={projectKey}
          canManage={permissions.settings}
        />
      ) : (
        <div
          style={{
            borderRadius: 10,
            border: `1px solid ${token.colorBorderSecondary}`,
            overflow: 'hidden',
          }}
        >
          <IntegrationItem
            icon={<GithubOutlined style={{ color: token.colorText }} />}
            title={t('githubTitle', { defaultValue: 'GitHub' })}
            description={t('githubDescription', {
              defaultValue: 'Track branches, pull requests and commits on tasks',
            })}
            note={t('githubSoftwareOnly', { defaultValue: 'Software projects' })}
          />
        </div>
      )}

      <div
        style={{
          borderRadius: 10,
          border: `1px solid ${token.colorBorderSecondary}`,
          overflow: 'hidden',
        }}
      >
        <IntegrationItem
          icon={<MSTeamsIcon />}
          title={t('teamsTitle', { defaultValue: 'Microsoft Teams' })}
          description={t('teamsDescription', {
            defaultValue: 'Post task and status updates to your Teams channels',
          })}
          badge={integrationStatus?.teams?.channelCount}
          channels={integrationStatus?.teams?.channels}
          locked={!hasBusinessAccess}
          onClick={handleTeamsClick}
        />
      </div>

      {projectId && (
        <TeamsProjectModal
          open={teamsModalOpen}
          projectId={projectId}
          projectName={projectName}
          onClose={() => setTeamsModalOpen(false)}
          onChange={fetchIntegrationStatus}
        />
      )}

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
