import { Layout } from '@/shared/antd-imports';
import { Outlet, useLocation } from 'react-router-dom';
import { memo, useMemo } from 'react';

import GlobalUpgradeModal from '@/components/upgrade/GlobalUpgradeModal';
import { PROJECTS_RAIL_SUB_ROUTES, FINANCE_RAIL_SUB_ROUTES } from '@/features/navigation/nav-registry';
import { useHomeDashboardSocketSync } from '@/hooks/useHomeDashboardSocketSync';

const MainLayout = memo(() => {
  const location = useLocation();

  // Mounted here (rather than HomeLayout) so Home's RTK Query cache is kept
  // fresh even when the triggering event fires while the user is elsewhere
  // in the app, e.g. changing a task's status from a Project view — HomeLayout
  // unmounts and stops listening the moment you navigate away from Home.
  useHomeDashboardSocketSync();

  const isProjectView = useMemo(
    () =>
      (location.pathname.includes('/projects/') && !location.pathname.endsWith('/projects')) ||
      location.pathname.includes('/worklenz/planner') ||
      location.pathname.includes('/worklenz/schedule'),
    [location.pathname]
  );

  const isProjectListView = useMemo(
    () => location.pathname.includes('/projects') && location.search.includes('page='),
    [location.pathname, location.search]
  );

  const isHomePage = useMemo(
    () =>
      location.pathname === '/worklenz/home' ||
      location.pathname.endsWith('/home') ||
      location.pathname.startsWith('/worklenz/home/'),
    [location.pathname]
  );

  const isPlannerPage = useMemo(
    () => location.pathname.includes('/worklenz/planner'),
    [location.pathname]
  );

  // Any route nested under /worklenz/projects/ that the rail itself owns
  // (Time Entries, Recurring Tasks, etc.) — checked against the registry
  // rather than hardcoded paths, so this can't silently stop matching the
  // way a manual path list already did once a route moved under Projects.
  // Excludes /worklenz/projects/:projectId, whose segment won't be a known
  // rail item key.
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

  // Pages that mount their own SimpleRailLayout left rail (see main-routes.tsx)
  // need the full width for themselves — they handle their own content
  // padding internally, so MainLayout must not double up on it here.
  const hasSideRail = useMemo(
    () =>
      isHomePage ||
      isPlannerPage ||
      location.pathname === '/worklenz/projects' ||
      (location.pathname.endsWith('/projects') && !location.pathname.includes('/admin-center/')) ||
      isProjectsSubRoute ||
      location.pathname.includes('/worklenz/team-lead-reports') ||
      location.pathname === '/worklenz/finance' ||
      location.pathname.endsWith('/finance') ||
      isFinanceSubRoute,
    [location.pathname, isHomePage, isPlannerPage, isProjectsSubRoute, isFinanceSubRoute]
  );

  const contentClassName = [
    hasSideRail ? 'w-full' : 'px-4 sm:px-8 lg:px-12 xl:px-16 mx-auto w-full',
    !isProjectView && !isHomePage && !hasSideRail ? 'overflow-x-clip max-w-[1400px]' : '',
    isProjectListView && !hasSideRail ? 'overflow-x-clip max-w-[1600px]' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <Layout.Content className={contentClassName}>
        <Outlet />
      </Layout.Content>

      <GlobalUpgradeModal />
    </>
  );
});

MainLayout.displayName = 'MainLayout';

export default MainLayout;