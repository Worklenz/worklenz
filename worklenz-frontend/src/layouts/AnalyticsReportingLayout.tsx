import { ConfigProvider } from '@/shared/antd-imports';
import { Outlet, useLocation } from 'react-router-dom';
import { useAppSelector } from '@/hooks/useAppSelector';
import { AnalyticsSidebar } from '@/components/reporting/analytics/AnalyticsSidebar';
import GlobalUpgradeModal from '@/components/upgrade/GlobalUpgradeModal';
import { ANALYTICS_BASE_PATH } from '@/lib/reporting/analytics-nav';

/**
 * Dedicated layout for Reporting & Analytics — uses the prototype list sidebar,
 * not the shared NavRail used by classic reporting.
 */
const AnalyticsReportingLayout = () => {
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDark = themeMode === 'dark';
  const location = useLocation();
  const shellBg = isDark ? '#141414' : '#f5f5f5';
  const borderColor = isDark ? '#303030' : '#f0f0f0';
  const isHubIndex =
    location.pathname === ANALYTICS_BASE_PATH ||
    location.pathname === `${ANALYTICS_BASE_PATH}/`;
  const contentBg = isHubIndex ? shellBg : isDark ? '#1f1f1f' : '#ffffff';

  return (
    <ConfigProvider wave={{ disabled: true }}>
      <div
        style={{
          display: 'flex',
          height: 'calc(100vh - 52px)',
          overflow: 'hidden',
          background: shellBg,
        }}
      >
        <AnalyticsSidebar />

        <div
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'auto',
            padding: 24,
            background: contentBg,
            borderTopLeftRadius: 12,
            borderTop: `1px solid ${borderColor}`,
            borderLeft: `1px solid ${borderColor}`,
          }}
        >
          <Outlet />
        </div>
      </div>

      <GlobalUpgradeModal />
    </ConfigProvider>
  );
};

export default AnalyticsReportingLayout;
