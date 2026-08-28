import React, { useEffect, useMemo } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '../../hooks/useAppSelector';
import { useResponsive } from '../../hooks/useResponsive';
import ClientPortalSidebar from '../pages/client-portal/sidebar/client-portal-sidebar';
import { themeWiseColor } from '../../utils/themeWiseColor';
import { useAuthService } from '@/hooks/useAuth';
import { hasBusinessFeatureAccess } from '@/ee/utils/subscription-utils';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_client_portal_viewed } from '@/shared/worklenz-analytics-events';
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
import FeatureUpgradePreview from '@/components/upgrade/FeatureUpgradePreview';
import { useClientPortalFeaturePreviews } from '@/components/upgrade/clientPortalFeaturePreviews';
import GlobalUpgradeModal from '@/components/upgrade/GlobalUpgradeModal';

const CLIENT_PORTAL_BASE_PATH = '/worklenz/client-portal';

const ClientPortalLayout = () => {
  const { resolved } = useNavPreferences('client-portal');
  const sidebarCollapsed = resolved.collapsed;
  const { isMobile } = useResponsive();
  const location = useLocation();

  // theme details from theme slice
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  // Auth and business access check
  const auth = useAuthService();
  const currentSession = auth.getCurrentSession();
  const hasBusinessAccess = hasBusinessFeatureAccess(currentSession);
  const { trackMixpanelEvent } = useMixpanelTracking();

  // Which tab is active, so the locked view can show that tab's own preview
  // (e.g. Requests' own mockup) instead of always showing the same "Clients"
  // screen regardless of which nav item was clicked — same pattern as
  // Finance's FinanceRailLayout.
  const activeKey = useMemo(() => {
    const rest = location.pathname.startsWith(CLIENT_PORTAL_BASE_PATH)
      ? location.pathname.slice(CLIENT_PORTAL_BASE_PATH.length).replace(/^\//, '')
      : '';
    const segment = rest.split('/')[0] || 'clients';
    // add-service/edit-service are sub-flows of the Services tab, not their
    // own nav item — show the Services preview for those too.
    if (segment === 'add-service' || segment === 'edit-service') return 'services';
    return segment;
  }, [location.pathname]);

  const clientPortalPreviews = useClientPortalFeaturePreviews();
  const lockedPreview = clientPortalPreviews[activeKey];

  // Redirect unauthorized users to main dashboard
  if (!auth.isAuthenticated()) {
    return <Navigate to="/auth/signin" replace />;
  }

  // Track client portal view
  useEffect(() => {
    trackMixpanelEvent(evt_client_portal_viewed);
  }, [trackMixpanelEvent]);

  // The Sider below is hidden entirely on mobile (ClientPortalSidebar renders
  // its own Drawer there instead), so this width only ever matters on
  // tablet/desktop.
  const sidebarWidth = sidebarCollapsed ? NAV_RAIL_COLLAPSED_WIDTH : NAV_RAIL_EXPANDED_WIDTH;
  const contentPadding = 24;
  const railBg = themeMode === 'dark' ? NAV_RAIL_BG_DARK : NAV_RAIL_BG_LIGHT;
  const railDividerColor = themeMode === 'dark' ? NAV_RAIL_DIVIDER_DARK : NAV_RAIL_DIVIDER_LIGHT;

  return (
    <div
      style={{
        display: 'flex',
        height: 'calc(100vh - 52px)',
        overflow: 'hidden',
        background: railBg,
      }}
    >
      {/* Sidebar - a floating button + Drawer on mobile (rendered by
          ClientPortalSidebar itself), fixed-width rail otherwise */}
      {isMobile ? (
        <ClientPortalSidebar />
      ) : (
        <div
          className="nav-rail-width-transition"
          style={{
            width: sidebarWidth,
            minWidth: sidebarWidth,
            flexShrink: 0,
            height: '100%',
            overflow: 'auto',
            background: railBg,
          }}
        >
          <ClientPortalSidebar />
        </div>
      )}

      {/* Main Content */}
      <div
        className="nav-rail-width-transition"
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'auto',
          background: themeWiseColor(NAV_RAIL_BG_LIGHT, '#1f1f1f', themeMode),
          ...(isMobile
            ? {}
            : {
                borderTopLeftRadius: 12,
                borderTop: `1px solid ${railDividerColor}`,
                borderLeft: `1px solid ${railDividerColor}`,
              }),
        }}
      >
        <div
          style={{
            padding: contentPadding,
            maxWidth: '100%',
            overflowX: 'hidden',
            height: '100%',
            boxSizing: 'border-box',
          }}
        >
          {hasBusinessAccess ? (
            <Outlet />
          ) : (
            <FeatureUpgradePreview
              key={activeKey}
              title={lockedPreview?.title ?? 'Clients'}
              description={
                lockedPreview?.description ??
                'Give clients a branded portal to track project progress, share files, and stay in the loop.'
              }
              features={
                lockedPreview?.features ?? [
                  'Branded client portal for sharing project progress',
                  'Client requests, approvals & messaging',
                  'Client-facing invoicing',
                  'Unlimited client accounts',
                ]
              }
              mockup={lockedPreview?.mockup ?? clientPortalPreviews.clients.mockup}
            />
          )}
        </div>
      </div>

      {/* Client Portal isn't nested under MainLayout (see main-routes.tsx vs
          client-portal-routes.tsx), so it doesn't get MainLayout's upgrade
          modal for free — same reason ReportingLayout mounts its own copy of
          GlobalUpgradeModal. Without this, the blurred previews' "Upgrade
          Now" button dispatches toggleUpgradeModal() to nothing, since no
          modal here would be listening. */}
      <GlobalUpgradeModal />
    </div>
  );
};

export default ClientPortalLayout;
