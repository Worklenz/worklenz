import { RouteObject, Navigate } from 'react-router-dom';
import React, { Suspense, lazy, type ReactNode } from 'react';
import ReportingLayout from '@/layouts/ReportingLayout';
import AnalyticsReportingLayout from '@/layouts/AnalyticsReportingLayout';
import { ReportingMenuItems, reportingsItems } from '@/lib/reporting/reporting-constants';
import { SuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';
import NavSurfaceIndexRedirect from '@/features/navigation/NavSurfaceIndexRedirect';
import { ANALYTICS_BASE_PATH, flatAnalyticsNavItems } from '@/lib/reporting/analytics-nav';
import { AnalyticsBusinessGate, AnalyticsFinanceGate } from '@/components/reporting/analytics/AnalyticsBusinessGate';
import { OrganizationPermissionGuard } from '@/guards/OrganizationPermissionGuard';
import { ORGANIZATION_PERMISSIONS } from '@/types/admin-center/permission-schemes.types';

const AllReportsPage = lazy(() => import('@/pages/reporting/analytics/AllReportsPage'));
const DashboardsPage = lazy(() => import('@/pages/reporting/analytics/DashboardsPage'));
const DashboardDetailPage = lazy(() => import('@/pages/reporting/analytics/DashboardDetailPage'));
const VelocityPage = lazy(() => import('@/pages/reporting/analytics/VelocityPage'));
const CumulativeFlowPage = lazy(() => import('@/pages/reporting/analytics/CumulativeFlowPage'));
const TimeInStatusPage = lazy(() => import('@/pages/reporting/analytics/TimeInStatusPage'));
const ProjectHealthPage = lazy(() => import('@/pages/reporting/analytics/ProjectHealthPage'));
const PlannedVsActualTasksPage = lazy(
  () => import('@/pages/reporting/analytics/PlannedVsActualTasksPage')
);
const PlannedVsActualMilestonesPage = lazy(
  () => import('@/pages/reporting/analytics/PlannedVsActualMilestonesPage')
);
const UtilizationPage = lazy(() => import('@/pages/reporting/analytics/UtilizationPage'));
const TimeReportPage = lazy(() => import('@/pages/reporting/analytics/TimeReportPage'));
const BudgetTrackingPage = lazy(() => import('@/pages/reporting/analytics/BudgetTrackingPage'));
const AnalyticsComingSoonPage = lazy(
  () => import('@/pages/reporting/analytics/AnalyticsComingSoonPage')
);
const CustomReportPage = lazy(() => import('@/pages/reporting/analytics/CustomReportPage'));

const withBusinessGate = (titleKey: string, titleDefault: string, element: ReactNode) => (
  <AnalyticsBusinessGate titleKey={titleKey} titleDefault={titleDefault}>
    {element}
  </AnalyticsBusinessGate>
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

const withSuspense = (element: ReactNode) => (
  <Suspense fallback={<SuspenseFallback />}>{element}</Suspense>
);

const enabledAnalyticsElements: Record<string, ReactNode> = {
  velocity: withBusinessGate('velocity', 'Velocity', <VelocityPage />),
  'cumulative-flow': withBusinessGate(
    'cumulativeFlow',
    'Cumulative Flow',
    <CumulativeFlowPage />
  ),
  'time-in-status': withBusinessGate('timeInStatus', 'Time in Status', <TimeInStatusPage />),
  'project-health': (
    <AnalyticsFinanceGate titleKey="projectHealth" titleDefault="Project Health">
      <ProjectHealthPage />
    </AnalyticsFinanceGate>
  ),
  'planned-vs-actual-tasks': <PlannedVsActualTasksPage />,
  'planned-vs-actual-milestones': <PlannedVsActualMilestonesPage />,
  utilization: <UtilizationPage />,
  'time-report': <TimeReportPage />,
  'budget-tracking': (
    <AnalyticsFinanceGate titleKey="budgetTracking" titleDefault="Budget Tracking">
      <BudgetTrackingPage />
    </AnalyticsFinanceGate>
  ),
  dashboards: <DashboardsPage />,
};

const comingSoonPaths = flatAnalyticsNavItems()
  .filter(item => item.path && !item.enabled)
  .map(item => item.path);

const reportingRoutes: RouteObject[] = [
  // New Reporting & Analytics — "View reports" (+ paid plan)
  {
    path: 'worklenz/reporting/analytics',
    element: (
      <OrganizationPermissionGuard
        permission={ORGANIZATION_PERMISSIONS.VIEW_REPORTS}
        blockFreePlan
      >
        <AnalyticsReportingLayout />
      </OrganizationPermissionGuard>
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
        element: withSuspense(<CustomReportPage />),
      },
      ...comingSoonPaths.map(path => ({
        path,
        element: withSuspense(
          path === 'sla' ? (
            withBusinessGate('sla', 'SLA Tracking', <AnalyticsComingSoonPage />)
          ) : (
            <AnalyticsComingSoonPage />
          )
        ),
      })),
      { path: '*', element: <Navigate to={ANALYTICS_BASE_PATH} replace /> },
    ],
  },
  // Classic reporting (NavRail) — same View reports gate
  {
    path: 'worklenz/reporting',
    element: (
      <OrganizationPermissionGuard
        permission={ORGANIZATION_PERMISSIONS.VIEW_REPORTS}
        blockFreePlan
      >
        <ReportingLayout />
      </OrganizationPermissionGuard>
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
