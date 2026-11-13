import { ConfigProvider } from '@/shared/antd-imports';
import { useEffect } from 'react';
import { useAppSelector } from '../hooks/useAppSelector';
import { useAppDispatch } from '../hooks/useAppDispatch';
import ReportingSider from '../pages/reporting/sidebar/reporting-sider';
import { Outlet } from 'react-router-dom';
import { reportingApiService } from '@/api/reporting/reporting.api.service';
import { setCurrentOrganization } from '@/features/reporting/reporting.slice';
import { fetchOrganizationDetails } from '@/features/admin-center/admin-center.slice';
import GlobalUpgradeModal from '@/components/upgrade/GlobalUpgradeModal';
import logger from '@/utils/errorLogger';

/**
 * Classic reporting layout — list-style sidebar matching analytics reporting chrome.
 * Other app surfaces (Home, Planner, etc.) keep using NavRail unchanged.
 */
const ReportingLayout = () => {
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDark = themeMode === 'dark';
  const shellBg = isDark ? '#141414' : '#f5f5f5';
  const borderColor = isDark ? '#303030' : '#f0f0f0';
  const contentBg = isDark ? '#1f1f1f' : '#ffffff';

  const fetchCurrentOrganization = async () => {
    try {
      const response = await reportingApiService.getInfo();
      if (response.done) {
        dispatch(setCurrentOrganization(response.body?.organization_name));
      }
    } catch (error) {
      logger.error('Error fetching current organization', error);
    }
  };

  useEffect(() => {
    fetchCurrentOrganization();
    dispatch(fetchOrganizationDetails());
  }, [dispatch]);

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
        <ReportingSider />

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

export default ReportingLayout;
