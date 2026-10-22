import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Dropdown,
  Tooltip,
  Badge,
  ApiOutlined,
  CrownOutlined,
} from '@/shared/antd-imports';
import { IntegrationsDropdown } from './IntegrationsDropdown';
import { slackApiService } from '@/api/slack/slack.api.service';
import { githubApiService } from '@/api/github/github.api.service';
import { useAppSelector } from '@/hooks/useAppSelector';
import { isSoftwareProjectType } from '@/lib/project/software-project';
import { useAuthService } from '@/hooks/useAuth';
import { hasBusinessFeatureAccess } from '@/utils/subscription-utils';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { showUpgradePrompt } from '@/features/admin-center/admin-center.slice';
import { teamsWebhooksApiService } from '@/api/teams-webhooks/teams-webhooks.api.service';
import type { ProjectIntegrationStatus } from './integrations.types';

interface ProjectIntegrationsButtonProps {
  projectId: string;
  projectName?: string;
}

export const ProjectIntegrationsButton: React.FC<ProjectIntegrationsButtonProps> = ({
  projectId,
  projectName,
}) => {
  const { t } = useTranslation('project-integrations');
  const dispatch = useAppDispatch();
  const authService = useAuthService();
  const currentSession = useMemo(() => authService.getCurrentSession(), [authService]);
  const hasBusinessAccess = useMemo(
    () => hasBusinessFeatureAccess(currentSession),
    [currentSession]
  );

  const isSoftwareProject = useAppSelector(state =>
    isSoftwareProjectType(state.projectReducer.project?.project_type)
  );

  const [open, setOpen] = useState(false);
  const [integrationStatus, setIntegrationStatus] = useState<ProjectIntegrationStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchIntegrationStatus = useCallback(async () => {
    if (!projectId || (!hasBusinessAccess && !isSoftwareProject)) return;

    try {
      setLoading(true);

      // GitHub is available to every team with software projects; Slack needs Business.
      const [slackWorkspace, slackConfigsResponse, teamsResponse, githubRepositories] = await Promise.all([
        hasBusinessAccess ? slackApiService.getStatus().catch(() => null) : null,
        hasBusinessAccess
          ? slackApiService.getProjectChannelConfigs(projectId).catch(() => null)
          : null,
        hasBusinessAccess
          ? teamsWebhooksApiService.getProjectWebhooks(projectId).catch(() => null)
          : null,
        isSoftwareProject
          ? githubApiService
              .getProjectRepositories(projectId)
              .then(response => response.body)
              .catch(() => null)
          : null,
      ]);

      const slackChannels = slackConfigsResponse?.body || [];
      const activeSlackChannels = Array.isArray(slackChannels)
        ? slackChannels.filter((ch: any) => ch.isActive)
        : [];

      const activeTeamsWebhooks = (teamsResponse?.body || []).filter(webhook => webhook.is_active);

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
        github: {
          connected: !!githubRepositories?.connected,
          accountConnected: !!githubRepositories?.connected,
          repositoryCount: githubRepositories?.linked?.length || 0,
        },
      });
    } catch (error) {
      console.error('Failed to fetch integration status:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, hasBusinessAccess, isSoftwareProject]);

  useEffect(() => {
    if (projectId) {
      fetchIntegrationStatus();
    }
  }, [projectId, fetchIntegrationStatus]);

  const activeCount = useMemo(() => {
    if (!integrationStatus) return 0;
    return (
      (integrationStatus.slack?.channelCount || 0) +
      (integrationStatus.teams?.channelCount || 0) +
      (integrationStatus.github?.repositoryCount || 0)
    );
  }, [integrationStatus]);

  const handleRefresh = useCallback(() => {
    fetchIntegrationStatus();
  }, [fetchIntegrationStatus]);

  const handleUpgradeClick = useCallback(() => {
    dispatch(
      showUpgradePrompt({
        title: 'Integrations',
        description:
          'Connect Slack, Teams, and GitHub to your projects. Available on the Business plan.',
      })
    );
  }, [dispatch]);

  // Non-business teams only get the upsell when no integration is available to them
  if (!hasBusinessAccess && !isSoftwareProject) {
    return (
      <Tooltip
        title={t('upgradeRequired', { defaultValue: 'Integrations available on Business plan' })}
      >
        <Badge count={<CrownOutlined style={{ color: '#faad14' }} />} offset={[-5, 5]}>
          <Button shape="circle" icon={<ApiOutlined />} onClick={handleUpgradeClick} />
        </Badge>
      </Tooltip>
    );
  }

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      popupRender={() => (
        <IntegrationsDropdown
          projectId={projectId}
          projectName={projectName}
          status={integrationStatus}
          hasBusinessAccess={hasBusinessAccess}
          isSoftwareProject={isSoftwareProject}
          onClose={() => setOpen(false)}
          onRefresh={handleRefresh}
        />
      )}
      trigger={['click']}
      placement="bottomRight"
    >
      <Tooltip title={t('tooltip', { defaultValue: 'Manage project integrations' })}>
        <Badge count={activeCount} offset={[-5, 5]} showZero={false}>
          <Button
            shape="circle"
            icon={<ApiOutlined />}
            type={activeCount > 0 ? 'primary' : 'default'}
            loading={loading}
          />
        </Badge>
      </Tooltip>
    </Dropdown>
  );
};
