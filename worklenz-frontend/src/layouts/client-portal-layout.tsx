import { Col, ConfigProvider, Flex, Layout, Alert, Result, Button } from '@/shared/antd-imports';
import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAppSelector } from '../hooks/useAppSelector';
import { useResponsive } from '../hooks/useResponsive';
import { colors } from '../styles/colors';
import ClientPortalSidebar from '../pages/client-portal/sidebar/client-portal-sidebar';
import Navbar from '@/features/navbar/navbar';
import { clientPortalItems } from '../lib/client-portal/client-portal-constants';
import { themeWiseColor } from '../utils/themeWiseColor';
import { useAuthService } from '@/hooks/useAuth';
import { hasBusinessFeatureAccess } from '@/utils/subscription-utils';

const ClientPortalLayout = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const navigate = useNavigate();

  // theme details from theme slice
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  // Auth and business access check
  const auth = useAuthService();
  const currentSession = auth.getCurrentSession();
  const hasBusinessAccess = hasBusinessFeatureAccess(currentSession);

  // Auto-collapse sidebar on mobile
  useEffect(() => {
    if (isMobile) {
      setSidebarCollapsed(true);
    }
  }, [isMobile]);

  const sidebarWidth = sidebarCollapsed ? 80 : 280;
  const contentPadding = isDesktop ? 32 : isTablet ? 24 : 16;

  return (
    <ConfigProvider
      theme={{
        components: {
          Layout: {
            colorBgLayout: themeMode === 'dark' ? colors.darkGray : colors.white,
            headerBg: themeMode === 'dark' ? colors.darkGray : colors.white,
          },
        },
      }}
    >
      <Layout
        style={{
          minHeight: '100vh',
          background: themeWiseColor('#fafafa', '#141414', themeMode),
        }}
      >
        {/* Fixed Header */}
        <Layout.Header
          className={`shadow-md ${themeMode === 'dark' ? 'shadow-[#5f5f5f1f]' : 'shadow-[#18181811]'}`}
          style={{
            zIndex: 1000,
            position: 'fixed',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            padding: 0,
            borderBottom: `1px solid ${themeWiseColor('#f0f0f0', '#303030', themeMode)}`,
            background: themeWiseColor('#fff', colors.darkGray, themeMode),
          }}
        >
          <Navbar />
        </Layout.Header>

        <Layout style={{ marginTop: 64 }}>
          {/* Sidebar - Hidden on mobile, collapsible on tablet/desktop */}
          {!isMobile && (
            <Layout.Sider
              width={sidebarWidth}
              collapsed={sidebarCollapsed}
              collapsedWidth={80}
              style={{
                position: 'fixed',
                left: 0,
                top: 64,
                bottom: 0,
                zIndex: 999,
                background: themeWiseColor('#fff', colors.darkGray, themeMode),
                borderRight: `1px solid ${themeWiseColor('#f0f0f0', '#303030', themeMode)}`,
                transition: 'all 0.2s ease',
                opacity: hasBusinessAccess ? 1 : 0.6,
                pointerEvents: hasBusinessAccess ? 'auto' : 'none',
              }}
            >
              <ClientPortalSidebar
                items={clientPortalItems}
                collapsed={sidebarCollapsed}
                onToggleCollapse={() => hasBusinessAccess && setSidebarCollapsed(!sidebarCollapsed)}
              />
            </Layout.Sider>
          )}

          {/* Main Content */}
          <Layout.Content
            style={{
              marginLeft: isMobile ? 0 : sidebarWidth,
              transition: 'margin-left 0.2s ease',
              minHeight: 'calc(100vh - 64px)',
            }}
          >
            <div
              style={{
                padding: contentPadding,
                maxWidth: '100%',
                overflowX: 'hidden',
              }}
            >
              {!hasBusinessAccess && (
                <Alert
                  message="Business Plan Required"
                  description="Client Portal features are available only on Business and Enterprise plans. Upgrade your plan to access these features."
                  type="warning"
                  showIcon
                  style={{ marginBottom: 16 }}
                  action={
                    <Button
                      size="small"
                      type="primary"
                      onClick={() => navigate('/worklenz/admin-center/billing')}
                    >
                      Upgrade Plan
                    </Button>
                  }
                />
              )}

              <div
                style={{
                  opacity: hasBusinessAccess ? 1 : 0.6,
                  pointerEvents: hasBusinessAccess ? 'auto' : 'none',
                }}
              >
                <Outlet />
              </div>
            </div>
          </Layout.Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
};

export default ClientPortalLayout;
