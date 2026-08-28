import { ConfigProvider, theme } from '@/shared/antd-imports';
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

const ReportingLayout = () => {
  const dispatch = useAppDispatch();
  const { resolved } = useNavPreferences('reporting');
  const isCollapsed = resolved.collapsed;
  const { token } = theme.useToken();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const railBg = themeMode === 'dark' ? NAV_RAIL_BG_DARK : NAV_RAIL_BG_LIGHT;
  const railDividerColor = themeMode === 'dark' ? NAV_RAIL_DIVIDER_DARK : NAV_RAIL_DIVIDER_LIGHT;

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
    // Fetch organization details for upgrade modal
    dispatch(fetchOrganizationDetails());
  }, [dispatch]);

  const sidebarWidth = isCollapsed ? NAV_RAIL_COLLAPSED_WIDTH : NAV_RAIL_EXPANDED_WIDTH;

  return (
    <ConfigProvider wave={{ disabled: true }}>
      <div style={{ display: 'flex', height: 'calc(100vh - 52px)', overflow: 'hidden', background: railBg }}>
        <div
          className="nav-rail-width-transition"
          style={{
            width: sidebarWidth,
            minWidth: sidebarWidth,
            flexShrink: 0,
            background: railBg,
            height: '100%',
            overflow: 'auto',
          }}
        >
          <ReportingSider />
        </div>

        <div
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'auto',
            padding: 24,
            background: token.colorBgContainer,
            borderTopLeftRadius: 12,
            borderTop: `1px solid ${railDividerColor}`,
            borderLeft: `1px solid ${railDividerColor}`,
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
