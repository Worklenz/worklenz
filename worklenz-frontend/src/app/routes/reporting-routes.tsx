import { RouteObject, Navigate } from 'react-router-dom';
import { Suspense, lazy, memo } from 'react';
import ReportingLayout from '@/layouts/ReportingLayout';
import AnalyticsReportingLayout from '@/layouts/AnalyticsReportingLayout';
import { ReportingMenuItems, reportingsItems } from '@/lib/reporting/reporting-constants';
import { SuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';
import NavSurfaceIndexRedirect from '@/features/navigation/NavSurfaceIndexRedirect';
import GuestRedirect from '@/guards/GuestRedirect';
import { useAuthStatus } from '@/hooks/useAuthStatus';
import { ANALYTICS_BASE_PATH } from '@/lib/reporting/analytics-nav';
import { flatAnalyticsNavItems } from '@/lib/reporting/analytics-nav';

const AllReportsPage = lazy(() => import('@/pages/reporting/analytics/AllReportsPage'));
const DashboardsPage = lazy(() => import('@/pages/reporting/analytics/DashboardsPage'));
const DashboardDetailPage = lazy(() => import('@/pages/reporting/analytics/DashboardDetailPage'));
const VelocityPage = lazy(() => import('@/pages/reporting/analytics/VelocityPage'));
const CumulativeFlowPage = lazy(() => import('@/pages/reporting/analytics/CumulativeFlowPage'));
const SlaPage = lazy(() => import('@/pages/reporting/analytics/SlaPage'));
const TimeInStatusPage = lazy(() => import('@/pages/reporting/analytics/TimeInStatusPage'));
const ProjectHealthPage = lazy(() => import('@/pages/reporting/analytics/ProjectHealthPage'));
const PlannedVsActualTasksPage = lazy(
  () => import('@/pages/reporting/analytics/PlannedVsActualTasksPage')
);
const AnalyticsComingSoonPage = lazy(
  () => import('@/pages/reporting/analytics/AnalyticsComingSoonPage')
);

const flattenItems = (items: ReportingMenuItems[]): ReportingMenuItems[] => {
  return items.reduce<ReportingMenuItems[]>((acc, item) => {
    if (item.children) {
      return [...acc, ...flattenItems(item.children)];
    }
    return [...acc, item];
  }, []);
};

const flattenedItems = flattenItems(reportingsItems);

const withSuspense = (element: React.ReactNode) => (
  <Suspense fallback={<SuspenseFallback />}>{element}</Suspense>
);

/** Classic reporting pages remain Owner/Admin (paid) only. */
const ExistingReportingAdminGuard = memo(({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isAdmin, location } = useAuthStatus();

  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (!isAdmin) {
    return <Navigate to={ANALYTICS_BASE_PATH} replace />;
  }

  return <>{children}</>;
});

ExistingReportingAdminGuard.displayName = 'ExistingReportingAdminGuard';

const enabledAnalyticsElements: Record<string, React.ReactNode> = {
  velocity: <VelocityPage />,
  'cumulative-flow': <CumulativeFlowPage />,
  'time-in-status': <TimeInStatusPage />,
  'project-health': <ProjectHealthPage />,
  'planned-vs-actual-tasks': <PlannedVsActualTasksPage />,
  sla: <SlaPage />,
  dashboards: <DashboardsPage />,
};

const comingSoonPaths = flatAnalyticsNavItems()
  .filter(item => item.path && !item.enabled)
  .map(item => item.path);

const reportingRoutes: RouteObject[] = [
  // New Reporting & Analytics (prototype sidebar) — listed first for specificity
  {
    path: 'worklenz/reporting/analytics',
    element: (
      <GuestRedirect blockPathPrefix="/worklenz/reporting">
        <AnalyticsReportingLayout />
      </GuestRedirect>
    ),
    children: [
      { index: true, element: withSuspense(<AllReportsPage />) },
      ...Object.entries(enabledAnalyticsElements).map(([path, element]) => ({
        path,
        element: withSuspense(element),
      })),
      {
        path: 'dashboards/:id',
        element: withSuspense(<DashboardDetailPage />),
      },
      {
        path: 'custom/:id',
        element: withSuspense(<AnalyticsComingSoonPage />),
      },
      ...comingSoonPaths.map(path => ({
        path,
        element: withSuspense(<AnalyticsComingSoonPage />),
      })),
      { path: '*', element: <Navigate to={ANALYTICS_BASE_PATH} replace /> },
    ],
  },
  // Classic reporting (NavRail) — Owner/Admin only
  {
    path: 'worklenz/reporting',
    element: (
      <GuestRedirect blockPathPrefix="/worklenz/reporting">
        <ExistingReportingAdminGuard>
          <ReportingLayout />
        </ExistingReportingAdminGuard>
      </GuestRedirect>
    ),
    children: [
      { index: true, element: <NavSurfaceIndexRedirect surfaceKey="reporting" /> },
      ...flattenedItems.map(item => ({
        path: item.endpoint,
        element: withSuspense(item.element),
      })),
      // Non-matching paths (except /analytics, handled by sibling route) bounce home
      { path: '*', element: <Navigate to="/worklenz/reporting" replace /> },
    ],
  },
];

export default reportingRoutes;
