import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button, ApiOutlined, SettingOutlined, TeamOutlined, theme } from '@/shared/antd-imports';
import { GithubOutlined } from '@ant-design/icons';
import { SlackProjectIntegration } from './SlackProjectIntegration';
import { IntegrationItem } from './IntegrationItem';
import type { ProjectIntegrationStatus } from './integrations.types';

interface IntegrationsDropdownProps {
  projectId: string;
  projectName?: string;
  status: ProjectIntegrationStatus | null;
  onClose: () => void;
  onRefresh?: () => void;
}

export const IntegrationsDropdown: React.FC<IntegrationsDropdownProps> = ({
  projectId,
  projectName,
  status,
  onClose,
  onRefresh,
}) => {
  const { t } = useTranslation('project-integrations');
  const navigate = useNavigate();
  const { token } = theme.useToken();

  // Better dark mode detection using multiple token properties
  const isDarkMode =
    token.colorBgContainer === '#1f1f1f' ||
    token.colorBgBase === '#141414' ||
    token.colorBgElevated === '#1f1f1f' ||
    document.documentElement.getAttribute('data-theme') === 'dark' ||
    document.body.classList.contains('dark');

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

  return (
    <div className="integrations-dropdown" style={dropdownStyles}>
      {/* Header */}
      <div style={headerStyles}>
        <ApiOutlined /> {t('title', { defaultValue: 'Integrations' })}
      </div>

      {/* Content */}
      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
        {/* Slack - Active */}
        <SlackProjectIntegration
          projectId={projectId}
          projectName={projectName}
          status={status?.slack || null}
          onClose={onClose}
          onRefresh={onRefresh}
        />

        {/* Microsoft Teams - Coming Soon */}
        <IntegrationItem
          icon={<TeamOutlined style={{ color: '#6264A7' }} />}
          title={t('teams.title', { defaultValue: 'Microsoft Teams' })}
          description={t('teams.description', {
            defaultValue: 'Send notifications to Teams channels',
          })}
          comingSoon
        />

        {/* GitHub - Coming Soon */}
        <IntegrationItem
          icon={<GithubOutlined style={{ color: '#24292e' }} />}
          title={t('github.title', { defaultValue: 'GitHub' })}
          description={t('github.description', { defaultValue: 'Sync tasks with GitHub issues' })}
          comingSoon
        />
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
