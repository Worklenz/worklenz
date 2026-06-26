import { Layout } from '@/shared/antd-imports';
import React, { useState, useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAppSelector } from '../hooks/useAppSelector';
import { useResponsive } from '../hooks/useResponsive';
import { colors } from '../styles/colors';
import ClientPortalSidebar from '../pages/client-portal/sidebar/client-portal-sidebar';
import Navbar from '@/features/navbar/navbar';
import { clientPortalItems } from '../lib/client-portal/client-portal-constants';
import { themeWiseColor } from '../utils/themeWiseColor';
import { useAuthService } from '@/hooks/useAuth';
import { useBusinessFeatures } from '@/worklenz-ee/hooks/use-business-features';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_client_portal_viewed } from '@/shared/worklenz-analytics-events';

const ClientPortalLayout = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { isMobile, isTablet, isDesktop } = useResponsive();

  // theme details from theme slice
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  // Auth and business access check
  const auth = useAuthService();
  const { hasBusinessAccess } = useBusinessFeatures();
  const { trackMixpanelEvent } = useMixpanelTracking();

  // Redirect unauthorized users to main dashboard
  if (!auth.isAuthenticated()) {
    return <Navigate to="/auth/signin" replace />;
  }

  if (!hasBusinessAccess) {
    return <Navigate to="/worklenz/admin-center/billing" replace />;
  }

  // Auto-collapse sidebar on mobile
  useEffect(() => {
    if (isMobile) {
      setSidebarCollapsed(true);
    }
  }, [isMobile]);

  // Track client portal view
  useEffect(() => {
    trackMixpanelEvent(evt_client_portal_viewed);
  }, [trackMixpanelEvent]);

  const sidebarWidth = sidebarCollapsed ? 80 : 280;
  const contentPadding = isDesktop ? 32 : isTablet ? 24 : 16;

  return (
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
            }}
          >
            <ClientPortalSidebar
              items={clientPortalItems}
              collapsed={sidebarCollapsed}
              onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
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
            <Outlet />
          </div>
        </Layout.Content>
      </Layout>
    </Layout>
  );
};

export default ClientPortalLayout;
