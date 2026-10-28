import React, { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { theme } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  ANALYTICS_NAV,
  analyticsPath,
  buildAnalyticsNavGroups,
  getAnalyticsNavIcon,
  type AnalyticsNavItem,
} from '@/lib/reporting/analytics-nav';
import { useAnalyticsCustomReports } from '@/features/reporting/analytics-custom-reports';
import './analytics-sidebar.css';

const AnalyticsSidebarLink: React.FC<{
  item: AnalyticsNavItem;
  active: boolean;
  isDark: boolean;
  /** When set, render this label instead of i18n (user-named custom reports). */
  labelOverride?: string;
}> = ({ item, active, isDark, labelOverride }) => {
  const { t } = useTranslation('reporting-analytics');
  const { token } = theme.useToken();
  const to = analyticsPath(item.path);

  return (
    <NavLink
      to={to}
      end={item.path === ''}
      className={`analytics-sider-link${active ? ' is-active' : ''}`}
      style={
        {
          '--analytics-sider-active-bg': isDark ? 'rgba(24, 144, 255, 0.18)' : 'rgba(24, 144, 255, 0.1)',
          '--analytics-sider-active-color': token.colorPrimary,
          '--analytics-sider-hover-bg': isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          '--analytics-sider-text': isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)',
        } as React.CSSProperties
      }
    >
      <span className="analytics-sider-link-icon" aria-hidden>
        {getAnalyticsNavIcon(item.key.startsWith('custom-') ? 'dashboards' : item.key)}
      </span>
      <span className="analytics-sider-link-label">
        {labelOverride ?? t(item.labelKey, { defaultValue: item.defaultLabel })}
      </span>
      {!item.enabled && item.key === 'sla' && (
        <span className="analytics-sider-coming-soon">
          {t('comingSoonBadge', { defaultValue: 'Coming soon' })}
        </span>
      )}
    </NavLink>
  );
};

/**
 * Prototype-style reports sidebar — horizontal list with group headers.
 * Custom reports group appears only when the user has saved custom reports.
 */
export const AnalyticsSidebar: React.FC = () => {
  const { t } = useTranslation('reporting-analytics');
  const { token } = theme.useToken();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDark = themeMode === 'dark';
  const location = useLocation();
  const { customReports } = useAnalyticsCustomReports();

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

  return (
    <nav
      className="analytics-sider"
      aria-label={t('analyticsNavAria', { defaultValue: 'Reports navigation' })}
      style={{
        background: isDark ? '#141414' : '#fafafa',
        borderRightColor: isDark ? '#303030' : '#f0f0f0',
        color: token.colorText,
      }}
    >
      <div className="analytics-sider-scroll">
        <AnalyticsSidebarLink
          item={ANALYTICS_NAV.allReports}
          active={activeKey === 'all-reports'}
          isDark={isDark}
        />

        {groups.map(group => (
          <div key={group.key} className="analytics-sider-group">
            <h4
              className="analytics-sider-group-label"
              style={{ color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)' }}
            >
              {t(group.labelKey, { defaultValue: group.defaultLabel })}
            </h4>
            {group.items.map(item => (
              <AnalyticsSidebarLink
                key={item.key}
                item={item}
                active={
                  activeKey === item.key ||
                  (item.key === 'dashboards' && activeKey === 'dashboards')
                }
                isDark={isDark}
                labelOverride={
                  item.key.startsWith('custom-') ? item.defaultLabel : undefined
                }
              />
            ))}
          </div>
        ))}
      </div>
    </nav>
  );
};

export default AnalyticsSidebar;
