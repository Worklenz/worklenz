import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Button,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  Tooltip,
  theme,
} from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { reportingsItems, type ReportingMenuItems } from '@/lib/reporting/reporting-constants';
import { ReportingModePaddle } from '@/components/reporting/ReportingModePaddle';
import '@/components/reporting/analytics/analytics-sidebar.css';

const CLASSIC_BASE_PATH = '/worklenz/reporting';
const COLLAPSED_STORAGE_KEY = 'worklenz.classicReportingSidebar.collapsed';
/** Matches useResponsive desktop breakpoint — collapse by default below this. */
const NARROW_VIEWPORT_QUERY = '(max-width: 1023px)';

const isNarrowViewport = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(NARROW_VIEWPORT_QUERY).matches;
};

const readCollapsedPreference = (): boolean => {
  try {
    const stored = localStorage.getItem(COLLAPSED_STORAGE_KEY);
    if (stored === '1') return true;
    if (stored === '0') return false;
    return isNarrowViewport();
  } catch {
    return isNarrowViewport();
  }
};

interface ClassicNavLinkProps {
  item: ReportingMenuItems;
  active: boolean;
  isDark: boolean;
  collapsed: boolean;
}

const ClassicSidebarLink: React.FC<ClassicNavLinkProps> = ({
  item,
  active,
  isDark,
  collapsed,
}) => {
  const { t } = useTranslation('reporting-sidebar');
  const { token } = theme.useToken();
  const to = `${CLASSIC_BASE_PATH}/${item.endpoint}`;
  const label = t(item.name, { defaultValue: item.defaultValue });

  const cssVars = {
    '--analytics-sider-active-bg': isDark ? 'rgba(24, 144, 255, 0.18)' : 'rgba(24, 144, 255, 0.1)',
    '--analytics-sider-active-color': token.colorPrimary,
    '--analytics-sider-hover-bg': isDark ? 'rgba(24, 144, 255, 0.12)' : 'rgba(24, 144, 255, 0.08)',
    '--analytics-sider-hover-color': token.colorPrimary,
    '--analytics-sider-text': isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)',
  } as React.CSSProperties;

  const content = (
    <>
      <span className="analytics-sider-link-icon" aria-hidden>
        {item.icon}
      </span>
      {!collapsed && <span className="analytics-sider-link-label">{label}</span>}
    </>
  );

  const link = (
    <NavLink
      to={to}
      className={`analytics-sider-link${active ? ' is-active' : ''}${collapsed ? ' is-collapsed' : ''}`}
      aria-label={label}
      style={cssVars}
    >
      {content}
    </NavLink>
  );

  if (!collapsed) return link;

  return (
    <Tooltip title={label} placement="right">
      {link}
    </Tooltip>
  );
};

/**
 * Classic reporting sidebar — same list-style chrome as analytics Reporting & Analytics,
 * with classic report destinations only. Does not use shared NavRail.
 */
const ReportingSider = () => {
  const { t } = useTranslation('reporting-sidebar');
  const { token } = theme.useToken();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDark = themeMode === 'dark';
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsedPreference);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      // Ignore storage failures (private mode, quota, etc.)
    }
  }, [collapsed]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => !prev);
  }, []);

  const { topItems, groups } = useMemo(() => {
    const top: ReportingMenuItems[] = [];
    const grouped: Array<{ key: string; labelKey: string; defaultLabel: string; items: ReportingMenuItems[] }> =
      [];

    for (const item of reportingsItems) {
      if (item.children?.length) {
        grouped.push({
          key: item.key,
          labelKey: item.name,
          defaultLabel: item.defaultValue,
          items: item.children,
        });
      } else {
        top.push(item);
      }
    }

    return { topItems: top, groups: grouped };
  }, []);

  const activeKey = useMemo(() => {
    const after = location.pathname.split(`${CLASSIC_BASE_PATH}/`)[1] ?? '';
    return after.split('/')[0];
  }, [location.pathname]);

  const collapseLabel = collapsed
    ? t('expandSidebar', { defaultValue: 'Expand sidebar' })
    : t('collapseSidebar', { defaultValue: 'Collapse sidebar' });

  return (
    <nav
      className={`analytics-sider${collapsed ? ' is-collapsed' : ''}`}
      aria-label={t('classicNavAria', { defaultValue: 'Classic reports navigation' })}
      style={{
        background: isDark ? '#141414' : '#fafafa',
        borderRightColor: isDark ? '#303030' : '#f0f0f0',
        color: token.colorText,
      }}
    >
      <div className="analytics-sider-toolbar">
        {!collapsed && (
          <span className="analytics-sider-toolbar-title" style={{ color: token.colorTextSecondary }}>
            {t('reportsTitle', { defaultValue: 'Reports' })}
          </span>
        )}
        <Tooltip title={collapseLabel} placement="right">
          <Button
            type="text"
            size="small"
            className="analytics-sider-toggle"
            aria-label={collapseLabel}
            aria-expanded={!collapsed}
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={toggleCollapsed}
          />
        </Tooltip>
      </div>

      <ReportingModePaddle
        mode="classic"
        collapsed={collapsed}
        className="analytics-sider-mode-paddle"
      />

      <div className="analytics-sider-scroll">
        {topItems.map(item => (
          <ClassicSidebarLink
            key={item.key}
            item={item}
            active={activeKey === item.endpoint || activeKey === item.key}
            isDark={isDark}
            collapsed={collapsed}
          />
        ))}

        {groups.map(group => (
          <div key={group.key} className="analytics-sider-group">
            {!collapsed && (
              <h4
                className="analytics-sider-group-label"
                style={{ color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)' }}
              >
                {t(group.labelKey, { defaultValue: group.defaultLabel })}
              </h4>
            )}
            {collapsed && <div className="analytics-sider-group-divider" aria-hidden />}
            {group.items.map(item => (
              <ClassicSidebarLink
                key={item.key}
                item={item}
                active={activeKey === item.endpoint || activeKey === item.key}
                isDark={isDark}
                collapsed={collapsed}
              />
            ))}
          </div>
        ))}
      </div>
    </nav>
  );
};

export default ReportingSider;
