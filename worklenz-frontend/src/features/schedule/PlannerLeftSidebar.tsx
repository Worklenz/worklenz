import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Tooltip,
  Popover,
  SettingOutlined,
  QuestionCircleOutlined,
  UserOutlined,
  BankOutlined,
  ProjectOutlined,
  DollarOutlined,
  MoonOutlined,
  SunOutlined,
  theme,
} from '@/shared/antd-imports';
import { ToolOutlined, MobileOutlined, ReadOutlined, MailOutlined, MessageOutlined } from '@ant-design/icons';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAuthService } from '@/hooks/useAuth';
import { ISUBSCRIPTION_TYPE } from '@/shared/constants';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { toggleTheme } from '@/features/theme/themeSlice';
import { useNavigate } from 'react-router-dom';
import MobileAppModal from '@/components/mobile-app/MobileAppModal';
import NavRail from '@/components/nav-rail/NavRail';
import { useNavPreferences } from '@/features/navigation/useNavPreferences';
import {
  NAV_RAIL_BG_DARK,
  NAV_RAIL_BG_LIGHT,
  NAV_RAIL_COLLAPSED_WIDTH,
  NAV_RAIL_DIVIDER_DARK,
  NAV_RAIL_DIVIDER_LIGHT,
  NAV_RAIL_EXPANDED_WIDTH,
} from '@/components/nav-rail/nav-rail-constants';
import '@/components/nav-rail/nav-rail.css';
import type { NavItem } from '@/features/navigation/nav-registry.types';

export type PlannerView = 'schedule' | 'timeline' | 'team' | 'workload' | 'calendar';

interface SettingsQuickLink {
  label: string;
  icon: React.ReactNode;
  to: string;
}

const SETTINGS_QUICK_LINKS: SettingsQuickLink[] = [
  { label: 'Profile Settings', icon: <UserOutlined />, to: '/worklenz/settings/profile' },
  { label: 'Workspace Settings', icon: <BankOutlined />, to: '/worklenz/settings/teams' },
  { label: 'Project Settings', icon: <ProjectOutlined />, to: '/worklenz/settings/categories' },
  { label: 'Finance Settings', icon: <DollarOutlined />, to: '/worklenz/settings/ratecard' },
  { label: 'General Settings', icon: <ToolOutlined />, to: '/worklenz/settings/configuration' },
];

interface HelpQuickLink {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

const HELP_QUICK_LINKS: HelpQuickLink[] = [
  {
    label: 'Documentation',
    icon: <ReadOutlined />,
    onClick: () => window.open('https://docs.worklenz.com/en/start/introduction/', '_blank'),
  },
  {
    label: 'Support Email',
    icon: <MailOutlined />,
    onClick: () => {
      window.location.href = 'mailto:support@worklenz.com';
    },
  },
  {
    label: 'Live Chat',
    icon: <MessageOutlined />,
    onClick: () => (window as any).HubSpotConversations?.widget?.open(),
  },
];

const BOTTOM_BTN: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
  width: '100%',
  padding: '7px 4px 6px',
  cursor: 'pointer',
  border: 'none',
  background: 'transparent',
  transition: 'all .15s',
  borderRadius: 7,
};

interface PlannerLeftSidebarProps {
  activeView: PlannerView;
  onViewChange: (view: PlannerView) => void;
}

const PlannerLeftSidebar: React.FC<PlannerLeftSidebarProps> = ({ activeView, onViewChange }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { t } = useTranslation('planner-sidebar');
  const authService = useAuthService();
  const currentSession = authService.getCurrentSession();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { token } = theme.useToken();
  const isDark = themeMode === 'dark';
  const dividerColor = isDark ? NAV_RAIL_DIVIDER_DARK : NAV_RAIL_DIVIDER_LIGHT;
  const borderColor = isDark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.08)';
  const bgColor = isDark ? NAV_RAIL_BG_DARK : NAV_RAIL_BG_LIGHT;
  const iconColor = isDark ? 'rgba(255,255,255,.45)' : 'rgba(0,0,0,.45)';
  // antd's default Tooltip renders a dark chip regardless of app theme, which read as a
  // mismatched box against this rail's light-mode chrome — same fix as NavRailItem uses
  // for the nav items themselves, applied here for the footer's own Tooltips.
  const tooltipProps = {
    color: isDark ? undefined : '#fff',
    overlayInnerStyle: isDark ? undefined : { color: token.colorText, boxShadow: '0 2px 8px rgba(0,0,0,.15)' },
  };

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [mobileModalOpen, setMobileModalOpen] = useState(false);

  const { resolved, pin, unpin, isPinned, reorder, toggleCollapsed } = useNavPreferences('planner');

  const renderLabel = useCallback(
    (item: NavItem) => {
      if (typeof item.label === 'string') return item.label;
      return t(item.label.i18nKey, { defaultValue: item.label.defaultValue });
    },
    [t]
  );

  const isTrial = currentSession?.subscription_type === ISUBSCRIPTION_TYPE.TRIAL;

  const trialDaysLeft = React.useMemo(() => {
    if (!isTrial) return null;
    const expiry = currentSession?.valid_till_date || (currentSession as any)?.trial_expire_date;
    if (!expiry) return null;
    const diff = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
    return diff > 0 ? diff : 0;
  }, [isTrial, currentSession]);

  return (
    <div
      className="nav-rail-width-transition"
      style={{
        width: resolved.collapsed ? NAV_RAIL_COLLAPSED_WIDTH : NAV_RAIL_EXPANDED_WIDTH,
        minWidth: resolved.collapsed ? NAV_RAIL_COLLAPSED_WIDTH : NAV_RAIL_EXPANDED_WIDTH,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: bgColor,
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <NavRail
        resolved={resolved}
        activeKey={activeView}
        isDark={isDark}
        onSelect={key => onViewChange(key as PlannerView)}
        isPinned={isPinned}
        onPin={pin}
        onUnpin={unpin}
        onReorder={reorder}
        onToggleCollapse={toggleCollapsed}
        renderLabel={renderLabel}
      />

      {/* ── Fixed bottom section — same as HomeLeftSidebar's ── */}
      <div
        style={{
          flexShrink: 0,
          width: '100%',
          padding: '8px 8px 16px',
          borderTop: `1px solid ${borderColor}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {/* Trial badge */}
        {isTrial && trialDaysLeft !== null && (
          <Tooltip title={`${trialDaysLeft} days left in your trial`} placement="right" {...tooltipProps}>
            <button
              onClick={() => dispatch(toggleUpgradeModal())}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: 48,
                padding: '4px 2px',
                background: 'transparent',
                cursor: 'pointer',
                border: 'none',
                gap: 0,
              }}
            >
              <span style={{ fontSize: 9, fontWeight: 400, lineHeight: 1.4, color: '#fa541c', textAlign: 'center' }}>
                {trialDaysLeft} Days
              </span>
              <span style={{ fontSize: 9, fontWeight: 400, lineHeight: 1.4, color: '#fa541c', textAlign: 'center' }}>
                Trial
              </span>
            </button>
          </Tooltip>
        )}

        {/* Upgrade button */}
        {isTrial && (
          <Tooltip title="Upgrade to Pro" placement="right" {...tooltipProps}>
            <button
              onClick={() => dispatch(toggleUpgradeModal())}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                width: '100%',
                padding: '8px 4px',
                borderRadius: 7,
                cursor: 'pointer',
                border: 'none',
                background: 'linear-gradient(135deg,#ff4d4f,#ff7875)',
                color: '#fff',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 0.2,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg,#cf1322,#ff4d4f)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(255,77,79,.4)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg,#ff4d4f,#ff7875)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>⚡</span>
              UPGRADE
            </button>
          </Tooltip>
        )}

        {/* Settings, Mobile App, and Help buttons — commented out for now,
            not removed, so they're easy to restore later.
        <Popover
          trigger="click"
          placement="rightBottom"
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          content={
            <div style={{ width: 200, padding: '4px 0' }}>
              {SETTINGS_QUICK_LINKS.map(link => (
                <div
                  key={link.label}
                  onClick={() => {
                    setSettingsOpen(false);
                    navigate(link.to);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    cursor: 'pointer',
                    fontSize: 13,
                    color: isDark ? 'rgba(255,255,255,.85)' : 'rgba(0,0,0,.85)',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.background = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                  }}
                >
                  <span style={{ fontSize: 14, display: 'flex' }}>{link.icon}</span>
                  <span>{link.label}</span>
                </div>
              ))}
              <div style={{ height: 1, margin: '4px 0', background: dividerColor }} />
              <div
                onClick={() => dispatch(toggleTheme())}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: isDark ? 'rgba(255,255,255,.85)' : 'rgba(0,0,0,.85)',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.background = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 14, display: 'flex' }}>{isDark ? <SunOutlined /> : <MoonOutlined />}</span>
                  <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    padding: '2px 8px',
                    borderRadius: 10,
                    background: isDark ? token.colorPrimary : 'rgba(0,0,0,.08)',
                    color: isDark ? '#fff' : 'rgba(0,0,0,.55)',
                  }}
                >
                  {isDark ? 'On' : 'Off'}
                </span>
              </div>
            </div>
          }
        >
          <Tooltip title="Settings" placement="right" {...tooltipProps}>
            <button
              style={{
                ...BOTTOM_BTN,
                color: settingsOpen ? token.colorPrimary : iconColor,
                background: settingsOpen ? token.colorPrimaryBg : 'transparent',
              }}
              onMouseEnter={e => {
                if (!settingsOpen) {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.background = isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.04)';
                  el.style.color = token.colorPrimary;
                }
              }}
              onMouseLeave={e => {
                if (!settingsOpen) {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.background = 'transparent';
                  el.style.color = iconColor;
                }
              }}
            >
              <SettingOutlined style={{ fontSize: 16 }} />
              <span style={{ fontSize: 9, fontWeight: 500, lineHeight: 1 }}>Settings</span>
            </button>
          </Tooltip>
        </Popover>

        <Tooltip title="Get Mobile App" placement="right" {...tooltipProps}>
          <button
            onClick={() => setMobileModalOpen(true)}
            style={{
              ...BOTTOM_BTN,
              color: mobileModalOpen ? token.colorPrimary : iconColor,
              background: mobileModalOpen ? token.colorPrimaryBg : 'transparent',
            }}
            onMouseEnter={e => {
              if (!mobileModalOpen) {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.04)';
                el.style.color = token.colorPrimary;
              }
            }}
            onMouseLeave={e => {
              if (!mobileModalOpen) {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = 'transparent';
                el.style.color = iconColor;
              }
            }}
          >
            <MobileOutlined style={{ fontSize: 16 }} />
            <span style={{ fontSize: 9, fontWeight: 500, lineHeight: 1 }}>Mobile</span>
          </button>
        </Tooltip>

        <Popover
          trigger="click"
          placement="rightBottom"
          open={helpOpen}
          onOpenChange={setHelpOpen}
          content={
            <div style={{ width: 200, padding: '4px 0' }}>
              {HELP_QUICK_LINKS.map(link => (
                <div
                  key={link.label}
                  onClick={() => {
                    setHelpOpen(false);
                    link.onClick();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    cursor: 'pointer',
                    fontSize: 13,
                    color: isDark ? 'rgba(255,255,255,.85)' : 'rgba(0,0,0,.85)',
                    borderRadius: 7,
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLDivElement;
                    el.style.background = token.colorPrimaryBg;
                    el.style.color = token.colorPrimary;
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLDivElement;
                    el.style.background = 'transparent';
                    el.style.color = isDark ? 'rgba(255,255,255,.85)' : 'rgba(0,0,0,.85)';
                  }}
                >
                  <span style={{ fontSize: 14, display: 'flex' }}>{link.icon}</span>
                  <span>{link.label}</span>
                </div>
              ))}
            </div>
          }
        >
          <Tooltip title="Help & Support" placement="right" {...tooltipProps}>
            <button
              style={{
                ...BOTTOM_BTN,
                color: helpOpen ? token.colorPrimary : iconColor,
                background: helpOpen ? token.colorPrimaryBg : 'transparent',
              }}
              onMouseEnter={e => {
                if (!helpOpen) {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.background = isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.04)';
                  el.style.color = token.colorPrimary;
                }
              }}
              onMouseLeave={e => {
                if (!helpOpen) {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.background = 'transparent';
                  el.style.color = iconColor;
                }
              }}
            >
              <QuestionCircleOutlined style={{ fontSize: 16 }} />
              <span style={{ fontSize: 9, fontWeight: 500, lineHeight: 1 }}>Help</span>
            </button>
          </Tooltip>
        </Popover>
        */}
      </div>

      <MobileAppModal open={mobileModalOpen} onClose={() => setMobileModalOpen(false)} />
    </div>
  );
};

export default PlannerLeftSidebar;
