import { Layout } from '@/shared/antd-imports';
import { Outlet, useLocation } from 'react-router-dom';
import { memo, useMemo } from 'react';

import Navbar from '@/features/navbar/navbar';
import { useAppSelector } from '../hooks/useAppSelector';
import { useAuthService } from '../hooks/useAuth';
import { TrialExpirationAlert } from '@/components/TrialExpirationAlert/TrialExpirationAlert';
import { ImportProgressNotifier } from '@/components/imports/ImportProgressNotifier';
import { MobileAppBanner } from '@/components/mobile-app/MobileAppBanner';
import { AppSumoPopup } from '@/components/appsumo-popup/AppSumoPopup';
import { NAV_RAIL_BG_DARK, NAV_RAIL_BG_LIGHT } from '@/components/nav-rail/nav-rail-constants';
import { PROJECTS_RAIL_SUB_ROUTES, FINANCE_RAIL_SUB_ROUTES } from '@/features/navigation/nav-registry';
import { shouldShowAppSumoPromo } from '@/ee/utils/subscription-utils';

// Single shared header for every authenticated section (main app, reporting,
// client portal) so there is exactly one <Navbar/> mount and one header
// height (52px) instead of each section re-implementing its own.
const AppShellLayout = memo(() => {
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const billingInfo = useAppSelector(state => state.adminCenterReducer.billingInfo);
  const location = useLocation();
  const authService = useAuthService();
  const currentSession = authService.getCurrentSession();
  const isOwnerOrAdmin = authService.isOwnerOrAdmin();

  const isAppSumoUser = useMemo(
    () => shouldShowAppSumoPromo(currentSession, billingInfo) && isOwnerOrAdmin,
    [billingInfo, currentSession, isOwnerOrAdmin]
  );

  // Any route nested under /worklenz/projects/ that the rail itself owns —
  // checked against the registry rather than hardcoded paths, so this can't
  // silently stop matching a route that moved under Projects. Excludes
  // /worklenz/projects/:projectId, whose segment won't be a known item key.
  const isProjectsSubRoute = useMemo(() => {
    const prefix = '/worklenz/projects/';
    if (!location.pathname.startsWith(prefix)) return false;
    const segment = location.pathname.slice(prefix.length).split('/')[0];
    return PROJECTS_RAIL_SUB_ROUTES.has(segment);
  }, [location.pathname]);

  // Same idea as isProjectsSubRoute above, for Finance's own SimpleRailLayout
  // sub-routes (Profitability, Budgets, Invoices, ...).
  const isFinanceSubRoute = useMemo(() => {
    const prefix = '/worklenz/finance/';
    if (!location.pathname.startsWith(prefix)) return false;
    const segment = location.pathname.slice(prefix.length).split('/')[0];
    return FINANCE_RAIL_SUB_ROUTES.has(segment);
  }, [location.pathname]);

  // Every section below mounts its own left rail directly below the header,
  // styled to share its background — the header must match that color
  // exactly so the two read as one unified panel rather than two adjacent
  // surfaces with a visible seam between them.
  const hasLeftRail = useMemo(
    () =>
      location.pathname === '/worklenz/home' ||
      location.pathname.endsWith('/home') ||
      location.pathname.startsWith('/worklenz/home/') ||
      location.pathname.includes('/worklenz/planner') ||
      location.pathname.includes('/worklenz/schedule') ||
      location.pathname.includes('/worklenz/reporting') ||
      location.pathname.includes('/worklenz/client-portal') ||
      location.pathname === '/worklenz/projects' ||
      (location.pathname.endsWith('/projects') && !location.pathname.includes('/admin-center/')) ||
      isProjectsSubRoute ||
      location.pathname.includes('/worklenz/team-lead-reports') ||
      location.pathname === '/worklenz/finance' ||
      location.pathname.endsWith('/finance') ||
      isFinanceSubRoute,
    [location.pathname, isProjectsSubRoute, isFinanceSubRoute]
  );
  const railPanelBg = themeMode === 'dark' ? NAV_RAIL_BG_DARK : NAV_RAIL_BG_LIGHT;

  return (
    <Layout className="min-h-screen">
      <ImportProgressNotifier />
      <AppSumoPopup
        isAppSumoUser={isAppSumoUser}
        frequencyDays={currentSession?.appsumo_popup_frequency_days}
      />
      <MobileAppBanner />
      <TrialExpirationAlert />

      <Layout.Header
        className={`sticky top-0 z-[999] flex items-center p-0 ${
          hasLeftRail ? '' : themeMode === 'dark' ? 'shadow-md border-b border-[#303030]' : 'shadow-md shadow-[#18181811]'
        }`}
        style={{
          height: 52,
          lineHeight: '52px',
          ...(hasLeftRail ? { background: railPanelBg } : {}),
        }}
      >
        <Navbar />
      </Layout.Header>

      <Outlet />
    </Layout>
  );
});

AppShellLayout.displayName = 'AppShellLayout';

export default AppShellLayout;
