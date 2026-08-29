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
import { slackApiService } from '@/ee/api/slack/slack.api.service';
import { useAuthService } from '@/hooks/useAuth';
import { hasBusinessFeatureAccess } from '@/ee/utils/subscription-utils';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { showUpgradePrompt } from '@/features/admin-center/admin-center.slice';
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

  const [open, setOpen] = useState(false);
  const [integrationStatus, setIntegrationStatus] = useState<ProjectIntegrationStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchIntegrationStatus = useCallback(async () => {
    if (!projectId || !hasBusinessAccess) return;

    try {
      setLoading(true);

      // Fetch Slack status
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
        teams: {
          connected: false,
          tenantConnected: false,
          channelCount: 0,
        },
        github: {
          connected: false,
          accountConnected: false,
          repositoryCount: 0,
        },
      });
    } catch (error) {
      console.error('Failed to fetch integration status:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, hasBusinessAccess]);

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

  // Show premium button for non-business users
  if (!hasBusinessAccess) {
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
