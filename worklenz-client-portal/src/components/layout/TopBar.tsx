import {
  Avatar,
  Button,
  Dropdown,
  Flex,
  Layout,
  Select,
  Typography,
  BankOutlined,
  CheckOutlined,
  LogoutOutlined,
  MenuOutlined,
  MoonOutlined,
  SettingOutlined,
  SunOutlined,
  theme,
} from '@/shared/antd-imports';
import type { MenuProps } from '@/shared/antd-imports';
import './profile-dropdown.css';
import { useRef, useState } from 'react';
import { Link, useLocation, useMatch, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useResponsive } from '@/hooks/useResponsive';
import { useClientAccess } from '@/hooks/useClientAccess';
import { useGetProjectsV2Query } from '@/store/api-v2';
import { useGetOrganizationSettingsQuery } from '@/store/api';
import { logoutUser } from '@/store/slices/authSlice';
import { setTheme } from '@/store/slices/uiSlice';
import { TeamSwitcher, teamDisplayName, teamSecondaryLabel } from '@/components/TeamSwitcher';
import { useTeamSwitch } from '@/hooks/useTeamSwitch';
import worklenzLogoLight from '@/assets/images/worklenz-light-mode.png';
import worklenzLogoDark from '@/assets/images/worklenz-dark-mode.png';
import { NotificationBell } from './NotificationBell';
import { GlobalSearch } from './GlobalSearch';
import { CreateMenu } from './CreateMenu';
import { railBackground } from './navigation';

const { Header } = Layout;

export const TOP_BAR_HEIGHT = 56;

const initialOf = (value: string | null | undefined): string => (value?.trim()[0] ?? 'C').toUpperCase();

interface TopBarProps {
  onOpenMenu: () => void;
}

export const TopBar = ({ onOpenMenu }: TopBarProps) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile } = useResponsive();
  const { me, role } = useClientAccess();
  const { teams, currentTeam, canSwitch, isSwitching, switchTo } = useTeamSwitch();
  const currentTheme = useAppSelector(state => state.ui.theme);
  const { data: settingsData, isLoading: isBrandingLoading } = useGetOrganizationSettingsQuery();
  const { data: projects } = useGetProjectsV2Query();
  const projectMatch = useMatch('/projects/:projectId/*');

  const logoUrl = settingsData?.body?.logo_url ?? null;
  // The operator's logo wins; with no logo the Worklenz logo shows. The title beside it is always the
  // common name, like Jira and Monday do: the operator's Portal Title is shown in the portal switcher only.
  const title = t('app.name', { defaultValue: 'Client Portal' });
  const isDark = currentTheme === 'dark';
  const defaultTeamName = t('app.defaultPortalName', { defaultValue: 'Worklenz Client Portal' });
  const inProject = Boolean(projectMatch?.params.projectId);
  const [menuOpen, setMenuOpen] = useState(false);
  const keepMenuOpenRef = useRef(false);

  const signOut = async () => {
    await dispatch(logoutUser());
    navigate('/auth/login', { replace: true });
  };

  const roleLabel = role ? t(`status.role.${role}`, { defaultValue: role === 'admin' ? 'Client Admin' : role === 'member' ? 'Client Member' : 'Client Viewer' }) : null;
  const toggleTheme = () => {
    // The menu stays open so the switch is visible straight away.
    keepMenuOpenRef.current = true;
    dispatch(setTheme(isDark ? 'light' : 'dark'));
  };

  const menuItems: MenuProps['items'] = [
    {
      key: 'who',
      className: 'portal-profile-header-item',
      onClick: () => navigate('/settings/profile'),
      label: (
        <div
          role="link"
          aria-label={t('user.openProfile', { defaultValue: 'Open profile settings' })}
          style={{
            cursor: 'pointer',
            padding: '8px 12px 12px',
            background: token.colorFillTertiary,
            borderRadius: 6,
            lineHeight: 1.4,
          }}
        >
          <Typography.Text style={{ fontSize: 12, fontWeight: 500, color: token.colorTextSecondary }}>
            {t('user.accountHeading', { defaultValue: 'Account' })}
          </Typography.Text>
          <Flex gap={8} align="center" style={{ marginTop: 6 }}>
            <Avatar size={32} style={{ backgroundColor: token.colorPrimary, flexShrink: 0 }}>
              {initialOf(me?.name)}
            </Avatar>
            <Flex vertical style={{ flex: 1, minWidth: 0 }}>
              <Typography.Text ellipsis={{ tooltip: me?.name }} style={{ fontWeight: 600 }}>
                {me?.name ?? t('user.defaultName', { defaultValue: 'Client User' })}
              </Typography.Text>
              <Typography.Text ellipsis={{ tooltip: me?.email }} style={{ fontSize: 12 }}>
                {me?.email}
              </Typography.Text>
              {roleLabel && (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  (<span>{roleLabel}</span>)
                </Typography.Text>
              )}
            </Flex>
          </Flex>
        </div>
      ),
    },
    // Phones have no room for the top bar pill, so the teams are a submenu of the account menu.
    ...(isMobile && canSwitch
      ? [
          {
            key: 'teams',
            icon: <BankOutlined />,
            disabled: isSwitching,
            label: currentTeam
              ? t('organizations.switch_team_current', { defaultValue: 'Switch portal ({{name}})', name: teamDisplayName(currentTeam, defaultTeamName) })
              : t('organizations.switch_team', { defaultValue: 'Switch portal' }),
            children: teams.map(team => ({
              key: `team-${team.teamId}`,
              icon: team.teamId === currentTeam?.teamId ? <CheckOutlined /> : <span style={{ width: 14, display: 'inline-block' }} />,
              label: [teamDisplayName(team, defaultTeamName), teamSecondaryLabel(team, defaultTeamName)].filter(Boolean).join(' · '),
              onClick: () => void switchTo(team.teamId),
            })),
          },
        ]
      : []),
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: t('user.settings', { defaultValue: 'Settings' }),
      onClick: () => navigate('/settings'),
    },
    {
      key: 'theme',
      className: 'portal-profile-theme-item',
      icon: isDark ? <SunOutlined /> : <MoonOutlined />,
      label: (
        <>
          <span>
            {isDark ? t('user.lightMode', { defaultValue: 'Light mode' }) : t('user.darkMode', { defaultValue: 'Dark mode' })}
          </span>
          <span
            aria-hidden
            style={{
              fontSize: 10,
              fontWeight: 500,
              padding: '2px 8px',
              borderRadius: 10,
              background: isDark ? token.colorPrimary : token.colorFillSecondary,
              color: isDark ? token.colorTextLightSolid : token.colorTextSecondary,
            }}
          >
            {isDark ? t('user.themeOn', { defaultValue: 'On' }) : t('user.themeOff', { defaultValue: 'Off' })}
          </span>
        </>
      ),
      onClick: toggleTheme,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      danger: true,
      label: t('user.signOut', { defaultValue: 'Sign out' }),
      onClick: () => void signOut(),
    },
  ];

  return (
    <Header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        height: TOP_BAR_HEIGHT,
        lineHeight: `${TOP_BAR_HEIGHT}px`,
        padding: `0 ${isMobile ? 12 : 20}px`,
        // Same colour as the rail below so the header and rail read as one panel; the content pane's
        // rounded corner provides the visual seam.
        background: railBackground(isDark, token.colorPrimary),
      }}
    >
      <Flex align="center" gap={12} style={{ height: '100%' }}>
        {isMobile && (
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={onOpenMenu}
            aria-label={t('navigation.open', { defaultValue: 'Open menu' })}
          />
        )}
        <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, textDecoration: 'none' }}>
          {isBrandingLoading ? (
            // Hold the space while the branding loads, so Worklenz's logo does not flash before the operator's.
            <span aria-hidden style={{ width: 120, height: 24, borderRadius: token.borderRadius, background: token.colorFillSecondary }} />
          ) : logoUrl ? (
            <img src={logoUrl} alt="" style={{ height: 28, maxWidth: 120, objectFit: 'contain' }} />
          ) : (
            // No logo uploaded yet: Worklenz's own, beside the Portal Title.
            <img
              src={isDark ? worklenzLogoDark : worklenzLogoLight}
              alt={t('app.worklenz', { defaultValue: 'Worklenz' })}
              style={{ height: 24, width: 'auto', flexShrink: 0 }}
            />
          )}
          {!isMobile && !isBrandingLoading && (
            <Typography.Text strong ellipsis style={{ maxWidth: 220, color: token.colorText }}>
              {title}
            </Typography.Text>
          )}
        </Link>

        {!isMobile && inProject && (projects?.length ?? 0) > 1 && (
          <Select
            size="small"
            value={projectMatch?.params.projectId}
            style={{ width: 220, maxWidth: 240 }}
            aria-label={t('topbar.currentProject', { defaultValue: 'Current project' })}
            options={projects?.map(project => ({ value: project.id, label: project.name }))}
            onChange={projectId => {
              const tab = location.pathname.split('/')[3];
              navigate(`/projects/${projectId}${tab ? `/${tab}` : ''}`);
            }}
          />
        )}

        <Flex align="center" gap={8} style={{ marginInlineStart: 'auto' }}>
          <GlobalSearch isMobile={isMobile} />
          <CreateMenu />
          <NotificationBell />
          {!isMobile && <TeamSwitcher />}
          <Dropdown
            overlayClassName="portal-profile-dropdown"
            menu={{ items: menuItems }}
            placement="bottomRight"
            trigger={['click']}
            open={menuOpen}
            onOpenChange={next => {
              if (!next && keepMenuOpenRef.current) {
                keepMenuOpenRef.current = false;
                return;
              }
              setMenuOpen(next);
            }}
          >
            <Button
              type="text"
              shape="circle"
              aria-label={t('user.menu', { defaultValue: 'Account menu' })}
              style={{ padding: 0, height: 36, width: 36 }}
            >
              <Avatar size={32} style={{ backgroundColor: token.colorPrimary }}>
                {initialOf(me?.name)}
              </Avatar>
            </Button>
          </Dropdown>
        </Flex>
      </Flex>
    </Header>
  );
};
