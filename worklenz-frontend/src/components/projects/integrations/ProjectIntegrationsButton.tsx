import { useState, useEffect, useMemo, useCallback, lazy, Suspense, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Dropdown, Tooltip, Badge, ApiOutlined, Spin } from '@/shared/antd-imports';
const IntegrationsDropdown = lazy(() =>
  import('./IntegrationsDropdown').then(module => ({ default: module.IntegrationsDropdown }))
);
import { slackApiService } from '@/api/slack/slack.api.service';
import { githubApiService } from '@/api/github/github.api.service';
import { useAppSelector } from '@/hooks/useAppSelector';
import { isSoftwareProjectType } from '@/lib/project/software-project';
import { useAuthService } from '@/hooks/useAuth';
import { hasBusinessFeatureAccess } from '@/utils/subscription-utils';
import { ProjectIntegrationCenterModal } from './ProjectIntegrationCenterModal';

import type { ProjectIntegrationStatus } from './integrations.types';

interface ProjectIntegrationsButtonProps {
  projectId: string;
  projectName?: string;
}

export const ProjectIntegrationsButton: React.FC<ProjectIntegrationsButtonProps> = memo(
  ({ projectId, projectName }) => {
    const { t } = useTranslation('project-integrations');
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
    const [centerOpen, setCenterOpen] = useState(false);
    const [hasOpened, setHasOpened] = useState(false);
    const [integrationStatus, setIntegrationStatus] = useState<ProjectIntegrationStatus | null>(
      null
    );
    const [loading, setLoading] = useState(false);

    const fetchIntegrationStatus = useCallback(async () => {
      if (!projectId || (!hasBusinessAccess && !isSoftwareProject)) return;

      try {
        setLoading(true);

        // GitHub is available to every team with software projects; Slack needs Business.
        const [slackWorkspace, slackConfigsResponse, githubRepositories] = await Promise.all([
          hasBusinessAccess ? slackApiService.getStatus().catch(() => null) : null,
          hasBusinessAccess
            ? slackApiService.getProjectChannelConfigs(projectId).catch(() => null)
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
            connected: !!githubRepositories?.connected,
            accountConnected: !!githubRepositories?.connected,
            repositoryCount: githubRepositories?.connected ? githubRepositories.linked.length : 0,
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

    const trigger = (
      <Tooltip title={t('tooltip', { defaultValue: 'Manage project integrations' })}>
        <Badge count={activeCount} offset={[-5, 5]} showZero={false}>
          <Button
            shape="circle"
            icon={<ApiOutlined />}
            type={activeCount > 0 ? 'primary' : 'default'}
            loading={loading}
            aria-label={t('tooltip', { defaultValue: 'Manage project integrations' })}
            autoFocus={hasOpened}
            onClick={
              hasOpened
                ? undefined
                : () => {
                    setHasOpened(true);
                    setOpen(true);
                    void fetchIntegrationStatus();
                  }
            }
          />
        </Badge>
      </Tooltip>
    );

    if (!hasOpened) return trigger;

    return (
      <>
        <Dropdown
          open={open}
          onOpenChange={nextOpen => {
            setOpen(nextOpen);
            if (nextOpen) void fetchIntegrationStatus();
          }}
          popupRender={() => (
            <Suspense fallback={<Spin size="small" />}>
              <IntegrationsDropdown
                projectId={projectId}
                projectName={projectName}
                status={integrationStatus}
                hasBusinessAccess={hasBusinessAccess}
                isSoftwareProject={isSoftwareProject}
                onClose={() => setOpen(false)}
                onRefresh={handleRefresh}
                onOpenCenter={() => setCenterOpen(true)}
              />
            </Suspense>
          )}
          trigger={['click']}
          placement="bottomRight"
        >
          {trigger}
        </Dropdown>
        <ProjectIntegrationCenterModal
          open={centerOpen}
          projectId={projectId}
          onClose={() => {
            setCenterOpen(false);
            void fetchIntegrationStatus();
          }}
        />
      </>
    );
  }
);

ProjectIntegrationsButton.displayName = 'ProjectIntegrationsButton';
