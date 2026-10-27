import { ConfigProvider, theme } from '@/shared/antd-imports';
import { Outlet } from 'react-router-dom';
import { useAppSelector } from '@/hooks/useAppSelector';
import { AnalyticsSidebar } from '@/components/reporting/analytics/AnalyticsSidebar';
import GlobalUpgradeModal from '@/components/upgrade/GlobalUpgradeModal';

/**
 * Dedicated layout for Reporting & Analytics — uses the prototype list sidebar,
 * not the shared NavRail used by classic reporting.
 */
const AnalyticsReportingLayout = () => {
  const { token } = theme.useToken();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDark = themeMode === 'dark';
  const shellBg = isDark ? '#141414' : '#f5f5f5';
  const borderColor = isDark ? '#303030' : '#f0f0f0';

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
            background: token.colorBgContainer,
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
