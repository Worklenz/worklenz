import type React from 'react';
import { Badge, Button, Tooltip, MenuFoldOutlined, MenuUnfoldOutlined, SettingOutlined, theme } from '@/shared/antd-imports';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useNavBadges } from '@/hooks/useNavBadges';
import { useAppSelector } from '@/hooks/useAppSelector';
import { activeNavKey, useNavItems } from './navigation';

interface IconRailSidebarProps {
  /** Called after an item is chosen (closes the mobile drawer). */
  onNavigate?: () => void;
  /** Wide layout used inside the mobile drawer. */
  stacked?: boolean;
  /** Icon-only rail (desktop). */
  collapsed?: boolean;
  /** Shows the expand/collapse control at the top of the rail when provided. */
  onToggleCollapse?: () => void;
}

export const IconRailSidebar = ({
  onNavigate,
  stacked = false,
  collapsed = false,
  onToggleCollapse,
}: IconRailSidebarProps) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const isDark = useAppSelector(state => state.ui.theme) === 'dark';
  const activeBackground = `color-mix(in srgb, ${token.colorPrimary} ${isDark ? 65 : 28}%, transparent)`;
  const location = useLocation();
  const badges = useNavBadges();
  const items = useNavItems();
  const active = activeNavKey(location.pathname);
  const iconOnly = collapsed && !stacked;

  const renderLink = ({ key, to, label, icon, count = 0 }: { key: string; to: string; label: string; icon: React.ReactNode; count?: number }) => {
    const isActive = active === key;
    const color = isActive ? (isDark ? '#ffffff' : token.colorText) : token.colorTextSecondary;
    return (
      <Tooltip key={key} title={iconOnly ? label : undefined} placement="right" mouseEnterDelay={0.3}>
        <Link
          to={to}
          onClick={onNavigate}
          aria-current={isActive ? 'page' : undefined}
          aria-label={count > 0 ? `${label} (${count})` : label}
          style={{
            display: 'flex',
            flexDirection: stacked ? 'row' : 'column',
            alignItems: 'center',
            justifyContent: stacked ? 'flex-start' : 'center',
            gap: stacked ? 12 : 3,
            padding: stacked ? '10px 12px' : iconOnly ? '3px 2px' : '6px 4px',
            borderRadius: stacked ? token.borderRadius : 8,
            margin: stacked ? 0 : '0 6px',
            // Icon-only rail: the active pill is a square behind the icon.
            ...(iconOnly ? { width: 36, height: 36, margin: '0 auto', padding: 0 } : {}),
            color,
            // Same pill as the portal switcher, stronger: the brand colour behind the active item, white text in dark mode.
            background: isActive ? activeBackground : 'transparent',
            fontSize: stacked ? token.fontSize : 11,
            fontWeight: 400,
            textAlign: 'center',
            lineHeight: 1.2,
            textDecoration: 'none',
            transition: 'color .15s, background-color .15s',
          }}
        >
          <Badge count={count} size="small" offset={[4, -2]}>
            <span aria-hidden style={{ fontSize: 16, color: 'inherit', display: 'flex' }}>
              {icon}
            </span>
          </Badge>
          {!iconOnly && <span>{label}</span>}
        </Link>
      </Tooltip>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minHeight: '100%' }}>
      {onToggleCollapse && !stacked && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
          <Button
            type="text"
            size="small"
            onClick={onToggleCollapse}
            aria-expanded={!collapsed}
            aria-label={
              collapsed
                ? t('navigation.expand', { defaultValue: 'Expand sidebar' })
                : t('navigation.collapse', { defaultValue: 'Collapse sidebar' })
            }
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            style={{ color: token.colorTextSecondary, fontSize: 16 }}
          />
        </div>
      )}
      <nav
        aria-label={t('navigation.label', { defaultValue: 'Main navigation' })}
        style={{ display: 'flex', flexDirection: 'column', gap: stacked ? 4 : 12, padding: stacked ? 8 : '8px 0' }}
      >
        {items.map(item => renderLink({
          key: item.key,
          to: `/${item.endpoint}`,
          label: t(item.name, { defaultValue: item.defaultLabel }),
          icon: item.icon,
          count: item.badge ? badges[item.badge] : 0,
        }))}
      </nav>
      {/* Pinned to the bottom of the rail. */}
      <div style={{ marginTop: 'auto', padding: stacked ? 8 : '8px 0 12px' }}>
        {renderLink({ key: 'settings', to: '/settings', label: t('navigation.settings', { defaultValue: 'Settings' }), icon: <SettingOutlined /> })}
      </div>
    </div>
  );
};
