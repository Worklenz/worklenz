import { Col, ConfigProvider, Layout } from '@/shared/antd-imports';
import { useEffect, useState } from 'react';
import Navbar from '@/features/navbar/navbar';
import { useAppSelector } from '../hooks/useAppSelector';
import { colors } from '../styles/colors';
import { themeWiseColor } from '../utils/themeWiseColor';
import ReportingSider from '../pages/reporting/sidebar/reporting-sider';
import { Outlet, useNavigate } from 'react-router-dom';
import ReportingCollapsedButton from '../pages/reporting/sidebar/reporting-collapsed-button';
import { useAuthService } from '@/hooks/useAuth';
import { reportingApiService } from '@/api/reporting/reporting.api.service';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setCurrentOrganization } from '@/features/reporting/reporting.slice';
import logger from '@/utils/errorLogger';

const ReportingLayout = () => {
  const dispatch = useAppDispatch();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { getCurrentSession } = useAuthService();
  const currentSession = getCurrentSession();
  const navigate = useNavigate();

  // function to handle collapse
  const handleCollapsedToggler = () => {
    setIsCollapsed(prev => !prev);
  };

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
  }, []);

  return (
    <ConfigProvider
      wave={{ disabled: true }}
      theme={{
        components: {
          Layout: {
            siderBg: themeMode === 'dark' ? colors.darkGray : colors.white,
          },
        },
      }}
    >
      <Layout
        style={{
          minHeight: '100vh',
        }}
      >
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

        <Layout.Sider
          collapsed={isCollapsed}
          collapsedWidth={24}
          width={160}
          style={{
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'fixed',
              zIndex: 120,
              height: '100vh',
              borderInlineEnd: `1px solid ${themeWiseColor('#f0f0f0', '#303030', themeMode)}`,
            }}
          >
            {/* sidebar collapsed button */}
            <ReportingCollapsedButton
              isCollapsed={isCollapsed}
              handleCollapseToggler={handleCollapsedToggler}
            />

            {!isCollapsed && (
              <div style={{ width: 160 }}>
                <ReportingSider />
              </div>
            )}
          </div>
        </Layout.Sider>

        <Layout.Content style={{ marginBlock: 96 }}>
          <Col style={{ paddingInline: 32 }}>
            <Outlet />
          </Col>
        </Layout.Content>
      </Layout>
    </ConfigProvider>
  );
};

export default ReportingLayout;
