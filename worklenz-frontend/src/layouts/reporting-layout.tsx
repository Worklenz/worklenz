import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Col from 'antd/es/col';
import ConfigProvider from 'antd/es/config-provider';
import Layout from 'antd/es/layout';

import Navbar from '../features/navbar/navbar';
import { useAppSelector } from '../@/hooks/use-app-selector';
import { useAppDispatch } from '@/hooks/use-app-dispatch';
import { colors } from '../styles/colors';
import { themeWiseColor } from '../utils/themeWiseColor';
import ReportingSider from '../pages/reporting/sidebar/reporting-sider';
import ReportingCollapsedButton from '../pages/reporting/sidebar/reporting-collapsed-button';
import { useAuthService } from '@/hooks/use-auth';
import { reportingApiService } from '@/api/reporting/reporting.api.service';
import { setCurrentOrganization } from '@/features/reporting/reporting.slice';
import logger from '@/utils/error-logger';

interface ReportingLayoutProps {}

const ReportingLayout: React.FC<ReportingLayoutProps> = React.memo(() => {
  const dispatch = useAppDispatch();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { getCurrentSession } = useAuthService();
  const currentSession = getCurrentSession();
  const navigate = useNavigate();

  // Memoize navigation callback
  const handleLicenseExpired = useCallback(() => {
    if (currentSession?.is_expired) {
      navigate('/worklenz/license-expired');
    }
  }, [currentSession?.is_expired, navigate]);

  useEffect(() => {
    handleLicenseExpired();
  }, [handleLicenseExpired]);

  // Memoize collapse handler
  const handleCollapsedToggler = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  // Memoize API call
  const fetchCurrentOrganization = useCallback(async () => {
    try {
      const response = await reportingApiService.getInfo();
      if (response.done) {
        dispatch(setCurrentOrganization(response.body?.organization_name));
      }
    } catch (error) {
      logger.error('Error fetching current organization', error);
    }
  }, [dispatch]);

  useEffect(() => {
    fetchCurrentOrganization();
  }, [fetchCurrentOrganization]);

  // Memoize theme configuration
  const themeConfig = useMemo(() => ({
    wave: { disabled: true },
    components: {
      Layout: {
        siderBg: themeMode === 'dark' ? colors.darkGray : colors.white,
      },
    },
  }), [themeMode]);

  // Memoize styles
  const layoutStyles = useMemo(() => ({
    minHeight: '100vh',
  }), []);

  const headerStyles = useMemo(() => ({
    zIndex: 999,
    position: 'fixed' as const,
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    padding: 0,
  }), []);

  const siderStyles = useMemo(() => ({
    position: 'relative' as const,
  }), []);

  const fixedSiderStyles = useMemo(() => ({
    position: 'fixed' as const,
    zIndex: 120,
    height: '100vh',
    borderInlineEnd: `1px solid ${themeWiseColor('#f0f0f0', '#303030', themeMode)}`,
  }), [themeMode]);

  const siderContentStyles = useMemo(() => ({
    width: 160,
  }), []);

  const contentStyles = useMemo(() => ({
    marginBlock: 96,
  }), []);

  const colStyles = useMemo(() => ({
    paddingInline: 32,
  }), []);

  const shadowClassName = useMemo(() => 
    `shadow-md ${themeMode === 'dark' ? 'shadow-[#5f5f5f1f]' : 'shadow-[#18181811]'}`,
    [themeMode]
  );

  return (
    <ConfigProvider theme={themeConfig}>
      <Layout style={layoutStyles}>
        <Layout.Header
          className={shadowClassName}
          style={headerStyles}
        >
          <Navbar />
        </Layout.Header>

        <Layout.Sider
          collapsed={isCollapsed}
          collapsedWidth={24}
          width={160}
          style={siderStyles}
        >
          <div style={fixedSiderStyles}>
            {/* sidebar collapsed button */}
            <ReportingCollapsedButton
              isCollapsed={isCollapsed}
              handleCollapseToggler={handleCollapsedToggler}
            />

            {!isCollapsed && (
              <div style={siderContentStyles}>
                <ReportingSider />
              </div>
            )}
          </div>
        </Layout.Sider>

        <Layout.Content style={contentStyles}>
          <Col style={colStyles}>
            <Outlet />
          </Col>
        </Layout.Content>
      </Layout>
    </ConfigProvider>
  );
});

ReportingLayout.displayName = 'ReportingLayout';

export default ReportingLayout;
