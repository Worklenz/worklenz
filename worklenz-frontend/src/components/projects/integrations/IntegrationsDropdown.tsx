import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button, ApiOutlined, SettingOutlined, theme } from '@/shared/antd-imports';
import { GithubOutlined } from '@ant-design/icons';
import { SlackProjectIntegration } from '../../../components/projects/integrations/SlackProjectIntegration';
import { IntegrationItem } from './IntegrationItem';
import { TeamsProjectIntegration } from './TeamsProjectIntegration';
import { MSTeamsIcon, SlackIcon } from '@/components/settings/integrations/IntegrationIcons';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { showUpgradePrompt } from '@/features/admin-center/admin-center.slice';
import {
  fetchProjectData,
  setProjectId as setDrawerProjectId,
  setProjectData,
} from '@/features/project/project-drawer.slice';
import {
  openProjectSettingsModal,
  setActiveSettingsSection,
} from '@/features/project/project-settings-modal.slice';
import { useAppSelector } from '@/hooks/useAppSelector';
import type { ProjectIntegrationStatus } from './integrations.types';

interface IntegrationsDropdownProps {
  projectId: string;
  projectName?: string;
  status: ProjectIntegrationStatus | null;
  hasBusinessAccess: boolean;
  isSoftwareProject: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

export const IntegrationsDropdown: React.FC<IntegrationsDropdownProps> = ({
  projectId,
  projectName,
  status,
  hasBusinessAccess,
  isSoftwareProject,
  onClose,
  onRefresh,
}) => {
  const { t } = useTranslation('project-integrations');
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();
  const selectedProject = useAppSelector(state => state.projectReducer.project);

  // Better dark mode detection using multiple token properties
  const isDarkMode =
    token.colorBgContainer === '#1f1f1f' ||
    token.colorBgBase === '#141414' ||
    token.colorBgElevated === '#1f1f1f' ||
    document.documentElement.getAttribute('data-theme') === 'dark' ||
    document.body.classList.contains('dark');

  const handleUpgradeClick = () => {
    dispatch(
      showUpgradePrompt({
        title: 'Integrations',
        description:
          'Connect Slack, Teams, and GitHub to your projects. Available on the Business plan.',
      })
    );
    onClose();
  };

  // Open the project's settings modal on its Integrations section (GitHub repositories live there).
  const handleOpenGithubSettings = () => {
    onClose();
    dispatch(setActiveSettingsSection('integrations'));
    dispatch(setDrawerProjectId(projectId));
    dispatch(fetchProjectData(projectId))
      .unwrap()
      .catch(() => {
        if (selectedProject) dispatch(setProjectData(selectedProject));
      })
      .finally(() => dispatch(openProjectSettingsModal()));
  };

  const handleManageAll = () => {
    navigate('/worklenz/settings/integrations');
    onClose();
  };

  // Memoize dropdown styles with dark mode support
  const dropdownStyles = {
    width: 360,
    backgroundColor: token.colorBgElevated,
    borderRadius: '8px',
    boxShadow: isDarkMode
      ? '0 3px 6px -4px rgba(0, 0, 0, 0.48), 0 6px 16px 0 rgba(0, 0, 0, 0.32), 0 9px 28px 8px rgba(0, 0, 0, 0.2)'
      : '0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
  };

  // Memoize header styles with dark mode support
  const headerStyles = {
    padding: '12px 16px',
    fontWeight: 600,
    fontSize: 14,
    borderBottom: `1px solid ${token.colorBorder}`,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: token.colorText,
  };

  // Memoize footer styles with dark mode support
  const footerStyles = {
    padding: '8px 16px',
    borderTop: `1px solid ${token.colorBorder}`,
    textAlign: 'center' as const,
  };

  const githubItem = (
    <IntegrationItem
      icon={<GithubOutlined style={{ color: token.colorText }} />}
      title={t('github.title', { defaultValue: 'GitHub' })}
      description={
        isSoftwareProject
          ? status?.github?.connected
            ? t('github.softwareDescription', {
                defaultValue:
                  'Branches, pull requests and commits on every task, with automatic status updates',
              })
            : t('github.connectDescription', {
                defaultValue:
                  'Connect GitHub to link repositories, track pull requests and automate task status',
              })
          : t('github.description', {
              defaultValue: 'Track branches, pull requests and commits on tasks',
            })
      }
      badge={status?.github?.repositoryCount}
      note={
        isSoftwareProject
          ? undefined
          : t('github.softwareOnly', { defaultValue: 'Software projects' })
      }
      onClick={isSoftwareProject ? handleOpenGithubSettings : undefined}
    />
  );

  return (
    <div className="integrations-dropdown" style={dropdownStyles}>
      {/* Header */}
      <div style={headerStyles}>
        <ApiOutlined /> {t('title', { defaultValue: 'Integrations' })}
      </div>

      {/* Content */}
      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
        {/* Slack - Active */}
        {hasBusinessAccess ? (
          <SlackProjectIntegration
            projectId={projectId}
            projectName={projectName}
            status={status?.slack || null}
            onClose={onClose}
            onRefresh={onRefresh}
          />
        ) : (
          <IntegrationItem
            icon={<SlackIcon />}
            title={t('slack.title', { defaultValue: 'Slack' })}
            description={t('slack.description', {
              defaultValue: 'Get task, status and comment updates in your Slack channels',
            })}
            locked
            onClick={handleUpgradeClick}
          />
        )}

        {/* Teams - Active */}
        {hasBusinessAccess ? (
          <TeamsProjectIntegration
            projectId={projectId}
            projectName={projectName}
            status={status?.teams || null}
            onClose={onClose}
            onRefresh={onRefresh}
          />
        ) : (
          <IntegrationItem
            icon={<MSTeamsIcon />}
            title={t('teams.title', { defaultValue: 'Microsoft Teams' })}
            description={t('teams.description', {
              defaultValue: 'Post task and status updates to your Teams channels',
            })}
            locked
            onClick={handleUpgradeClick}
          />
        )}

        {githubItem}
      </div>

      {/* Footer */}
      <div style={footerStyles}>
        <Button
          type="link"
          icon={<SettingOutlined />}
          onClick={handleManageAll}
          style={{ width: '100%' }}
        >
          {t('manageAll', { defaultValue: 'Manage All Integrations' })}
        </Button>
      </div>
    </div>
  );
};
