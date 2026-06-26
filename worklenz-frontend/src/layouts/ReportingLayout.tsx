import { Col, ConfigProvider, Layout, theme } from '@/shared/antd-imports';
import { useEffect, useState } from 'react';
import Navbar from '@/features/navbar/navbar';
import { useAppSelector } from '../hooks/useAppSelector';
import { useAppDispatch } from '../hooks/useAppDispatch';
import ReportingSider from '../pages/reporting/sidebar/reporting-sider';
import { Outlet } from 'react-router-dom';
import { reportingApiService } from '@/api/reporting/reporting.api.service';
import { setCurrentOrganization } from '@/features/reporting/reporting.slice';
import { fetchOrganizationDetails } from '@/features/admin-center/admin-center.slice';
import UpgradePlansModal from '@/worklenz-ee/components/UpgradePlansModal';
import logger from '@/utils/errorLogger';

const ReportingLayout = () => {
  const dispatch = useAppDispatch();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const { token } = theme.useToken();

  const themeMode = useAppSelector(state => state.themeReducer.mode);

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

  return (
    <ConfigProvider wave={{ disabled: true }}>
      <Layout style={{ minHeight: '100vh' }}>
        <Layout.Header
          className={`shadow-md ${themeMode === 'dark' ? 'shadow-[#5f5f5f1f]' : 'shadow-[#18181811]'}`}
          style={{
            zIndex: 999,
            position: 'fixed',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            padding: 0,
          }}
        >
          <Navbar />
        </Layout.Header>

        <Layout style={{ marginTop: 64 }}>
          <Layout.Sider
            trigger={null}
            collapsible
            collapsed={isCollapsed}
            collapsedWidth={80}
            width={240}
            style={{
              borderRight: `1px solid ${token.colorBorderSecondary}`,
              background: token.colorBgContainer,
              position: 'fixed',
              height: 'calc(100vh - 64px)',
              left: 0,
              top: 64,
              zIndex: 100,
              overflow: 'auto',
            }}
          >
            <ReportingSider
              collapsed={isCollapsed}
              onToggleCollapse={() => setIsCollapsed(prev => !prev)}
            />
          </Layout.Sider>

          <Layout
            style={{
              marginLeft: isCollapsed ? 80 : 240,
              transition: 'margin-left 0.2s cubic-bezier(0.645, 0.045, 0.355, 1)',
            }}
          >
            <Layout.Content style={{ padding: 32, minHeight: 'calc(100vh - 64px)' }}>
              <Outlet />
            </Layout.Content>
          </Layout>
        </Layout>
      </Layout>

      {/* Global Upgrade Modal */}
      <UpgradePlansModal />
    </ConfigProvider>
  );
};

export default ReportingLayout;
