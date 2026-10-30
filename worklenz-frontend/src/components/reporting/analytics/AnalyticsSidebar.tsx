import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Button,
  CrownOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  Tooltip,
  theme,
} from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAuthService } from '@/hooks/useAuth';
import { openUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { canUseFeature } from '@/utils/subscription-utils';
import {
  ANALYTICS_NAV,
  analyticsPath,
  buildAnalyticsNavGroups,
  getAnalyticsNavIcon,
  type AnalyticsNavItem,
} from '@/lib/reporting/analytics-nav';
import {
  syncTemplatesToCustomReports,
  useAnalyticsCustomReports,
} from '@/features/reporting/analytics-custom-reports';
import { analyticsTemplatesApiService } from '@/api/reporting/analytics-templates.api.service';
import './analytics-sidebar.css';

const COLLAPSED_STORAGE_KEY = 'worklenz.analyticsSidebar.collapsed';

const readCollapsedPreference = (): boolean => {
  try {
    return localStorage.getItem(COLLAPSED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

const AnalyticsSidebarLink: React.FC<{
  item: AnalyticsNavItem;
  active: boolean;
  isDark: boolean;
  collapsed: boolean;
  /** When set, render this label instead of i18n (user-named custom reports). */
  labelOverride?: string;
  businessLocked?: boolean;
  onBusinessLockedClick?: () => void;
}> = ({
  item,
  active,
  isDark,
  collapsed,
  labelOverride,
  businessLocked = false,
  onBusinessLockedClick,
}) => {
  const { t } = useTranslation('reporting-analytics');
  const { token } = theme.useToken();
  const to = analyticsPath(item.path);
  const label = labelOverride ?? t(item.labelKey, { defaultValue: item.defaultLabel });
  const isComingSoon = item.enabled === false && !businessLocked;
  const comingSoonLabel = t('comingSoonBadge', { defaultValue: 'Coming soon' });
  const businessLabel = t('businessPlanBadge', { defaultValue: 'Business' });

  const cssVars = {
    '--analytics-sider-active-bg': isDark ? 'rgba(24, 144, 255, 0.18)' : 'rgba(24, 144, 255, 0.1)',
    '--analytics-sider-active-color': token.colorPrimary,
    '--analytics-sider-hover-bg': isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    '--analytics-sider-text': isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)',
  } as React.CSSProperties;

  const content = (
    <>
      <span className="analytics-sider-link-icon" aria-hidden>
        {getAnalyticsNavIcon(item.key.startsWith('custom-') ? 'all-reports' : item.key)}
      </span>
      {!collapsed && (
        <>
          <span className="analytics-sider-link-label">{label}</span>
          {businessLocked ? (
            <CrownOutlined
              className="analytics-sider-crown"
              style={{ color: '#faad14', fontSize: 13, marginLeft: 'auto', flexShrink: 0 }}
              aria-hidden
            />
          ) : isComingSoon ? (
            <span className="analytics-sider-coming-soon">{comingSoonLabel}</span>
          ) : null}
        </>
      )}
      {collapsed && businessLocked && (
        <CrownOutlined
          style={{
            color: '#faad14',
            fontSize: 11,
            position: 'absolute',
            right: 4,
            top: 4,
          }}
          aria-hidden
        />
      )}
    </>
  );

  if (businessLocked) {
    const locked = (
      <button
        type="button"
        className={`analytics-sider-link is-locked${collapsed ? ' is-collapsed' : ''}`}
        aria-label={`${label} (${businessLabel})`}
        style={{ ...cssVars, position: 'relative' }}
        onClick={onBusinessLockedClick}
      >
        {content}
      </button>
    );
    if (!collapsed) return locked;
    return (
      <Tooltip title={`${label} (${businessLabel})`} placement="right">
        {locked}
      </Tooltip>
    );
  }

  // Coming soon items stay visible but are not navigable.
  const link = isComingSoon ? (
    <span
      className={`analytics-sider-link is-disabled${collapsed ? ' is-collapsed' : ''}`}
      aria-label={`${label} (${comingSoonLabel})`}
      aria-disabled="true"
      style={cssVars}
    >
      {content}
    </span>
  ) : (
    <NavLink
      to={to}
      end={item.path === ''}
      className={`analytics-sider-link${active ? ' is-active' : ''}${collapsed ? ' is-collapsed' : ''}`}
      aria-label={label}
      style={cssVars}
    >
      {content}
    </NavLink>
  );

  if (!collapsed) return link;

  return (
    <Tooltip
      title={isComingSoon ? `${label} (${comingSoonLabel})` : label}
      placement="right"
    >
      {link}
    </Tooltip>
  );
};

/**
 * Prototype-style reports sidebar ? horizontal list with group headers.
 * Custom reports group appears only when the user has saved custom reports.
 */
export const AnalyticsSidebar: React.FC = () => {
  const { t } = useTranslation('reporting-analytics');
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();
  const authService = useAuthService();
  const session = authService.getCurrentSession();
  const canAdvancedReporting = canUseFeature(session, 'advanced_reporting');
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDark = themeMode === 'dark';
  const location = useLocation();
  const { customReports, refreshCustomReports } = useAnalyticsCustomReports();
  const [collapsed, setCollapsed] = useState(readCollapsedPreference);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      // Ignore storage failures (private mode, quota, etc.)
    }
  }, [collapsed]);

  // Sync API-saved templates (all report kinds) into the Custom reports sidebar group.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await analyticsTemplatesApiService.listTemplates('all');
        if (!cancelled && res.done && Array.isArray(res.body)) {
          syncTemplatesToCustomReports(res.body);
          refreshCustomReports();
        }
      } catch {
        // Keep existing local custom templates if sync fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshCustomReports]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => !prev);
  }, []);

  const openUpgrade = useCallback(() => {
    dispatch(openUpgradeModal('default'));
  }, [dispatch]);

  const groups = useMemo(
    () => buildAnalyticsNavGroups(customReports),
    [customReports]
  );

  const activeKey = useMemo(() => {
    const rest = location.pathname.replace(/^\/worklenz\/reporting\/analytics\/?/, '');
    if (!rest) return 'all-reports';
    if (rest.startsWith('custom/')) return `custom-${rest.slice('custom/'.length).split('/')[0]}`;
    return rest.split('/')[0];
  }, [location.pathname]);

  const collapseLabel = collapsed
    ? t('expandSidebar', { defaultValue: 'Expand sidebar' })
    : t('collapseSidebar', { defaultValue: 'Collapse sidebar' });

  return (
    <nav
      className={`analytics-sider${collapsed ? ' is-collapsed' : ''}`}
      aria-label={t('analyticsNavAria', { defaultValue: 'Reports navigation' })}
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

      <div className="analytics-sider-scroll">
        <AnalyticsSidebarLink
          item={ANALYTICS_NAV.allReports}
          active={activeKey === 'all-reports'}
          isDark={isDark}
          collapsed={collapsed}
        />

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
              <AnalyticsSidebarLink
                key={item.key}
                item={item}
                active={activeKey === item.key}
                isDark={isDark}
                collapsed={collapsed}
                labelOverride={
                  item.key.startsWith('custom-') ? item.defaultLabel : undefined
                }
                businessLocked={Boolean(item.requiresBusinessPlan && !canAdvancedReporting)}
                onBusinessLockedClick={openUpgrade}
              />
            ))}
          </div>
        ))}
      </div>
    </nav>
  );
};

export default AnalyticsSidebar;
