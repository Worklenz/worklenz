import { RouteObject } from 'react-router-dom';
import { lazy, Suspense, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Skeleton from 'antd/es/skeleton';
import MainLayout from '@/layouts/MainLayout';
import SimpleRailLayout from '@/layouts/SimpleRailLayout';
import settingsRoutes from './settings-routes';
import adminCenterRoutes from './admin-center-routes';
import { useAuthService } from '@/hooks/useAuth';
import { hasBusinessFeatureAccess } from '@/ee/utils/subscription-utils';
import FeatureUpgradePreview from '@/components/upgrade/FeatureUpgradePreview';
import { useFinanceFeaturePreviews } from '@/components/upgrade/financeFeaturePreviews';
import { Navigate, useLocation } from 'react-router-dom';
import { SuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';
import NavSurfaceIndexRedirect from '@/features/navigation/NavSurfaceIndexRedirect';
import ChunkErrorHandler from '@/utils/chunk-error-handler';
import { isTeamLeadRole } from '@/types/roles/role.types';
import PlannerScheduleView from '@/features/schedule/PlannerScheduleView';
import PlannerTimelineView from '@/features/schedule/PlannerTimelineView';
import PlannerWorkloadView from '@/features/schedule/PlannerWorkloadView';
import { ControlOutlined, CalendarOutlined, InboxOutlined } from '@ant-design/icons';
import GuestRedirect from '@/guards/GuestRedirect';

// Lazy load page components for better code splitting with chunk error handling
const HomeLayout = lazy(
  ChunkErrorHandler.wrapLazyImport(() => import('@/pages/home/HomeLayout'), 'HomeLayout')
);
const HomeOverviewView = lazy(
  ChunkErrorHandler.wrapLazyImport(() => import('@/pages/home/HomeOverviewView'), 'HomeOverviewView')
);
const HomeMyTasksView = lazy(
  ChunkErrorHandler.wrapLazyImport(() => import('@/pages/home/HomeMyTasksView'), 'HomeMyTasksView')
);
const HomeCalendarView = lazy(
  ChunkErrorHandler.wrapLazyImport(() => import('@/pages/home/task-list/CalendarView'), 'CalendarView')
);
const HomeInboxView = lazy(
  ChunkErrorHandler.wrapLazyImport(() => import('@/pages/home/home-inbox/HomeInboxView'), 'HomeInboxView')
);
const HomeLogTime = lazy(
  ChunkErrorHandler.wrapLazyImport(() => import('@/pages/home/home-log-time/HomeLogTime'), 'HomeLogTime')
);
const HomeTodoList = lazy(
  ChunkErrorHandler.wrapLazyImport(() => import('@/pages/home/todo-list/todo-list'), 'TodoList')
);
const HomeMyTeam = lazy(
  ChunkErrorHandler.wrapLazyImport(() => import('@/pages/home/home-my-team/HomeMyTeam'), 'HomeMyTeam')
);
const HomeAddClient = lazy(
  ChunkErrorHandler.wrapLazyImport(() => import('@/pages/home/home-add-client/HomeAddClient'), 'HomeAddClient')
);
const ProjectList = lazy(
  ChunkErrorHandler.wrapLazyImport(() => import('@/pages/projects/project-list'), 'ProjectList')
);
const PlannerLayout = lazy(
  ChunkErrorHandler.wrapLazyImport(() => import('@/pages/schedule/PlannerLayout'), 'PlannerLayout')
);
const TimeEntriesPage = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/time-entries/TimeEntriesPage'),
    'TimeEntriesPage'
  )
);
const RecurringTasksPage = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/recurring-tasks/RecurringTasksPage'),
    'RecurringTasksPage'
  )
);
const FilesPage = lazy(
  ChunkErrorHandler.wrapLazyImport(() => import('@/pages/files/FilesPage'), 'FilesPage')
);
const TemplatesPage = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/projects/templates/TemplatesPage'),
    'TemplatesPage'
  )
);
const TeamLeadReports = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/team-lead-reports/team-lead-reports'),
    'TeamLeadReports'
  )
);

const ProjectView = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/projects/projectView/project-view'),
    'ProjectView'
  )
);
const TaskShortLinkRedirect = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/projects/projectView/TaskShortLinkRedirect'),
    'TaskShortLinkRedirect'
  )
);
const Unauthorized = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/unauthorized/unauthorized'),
    'Unauthorized'
  )
);
const GanttDemoPage = lazy(
  ChunkErrorHandler.wrapLazyImport(() => import('@/pages/GanttDemoPage'), 'GanttDemoPage')
);
const LicenseExpiredPage = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/ee/pages/license-expired/LicenseExpired'),
    'LicenseExpiredPage'
  )
);
const ComingSoonPage = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/coming-soon/ComingSoonPage'),
    'ComingSoonPage'
  )
);
const FinanceOverviewPage = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/finance-overview/FinanceOverviewPage'),
    'FinanceOverviewPage'
  )
);
const FinanceExpensesPage = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/finance-overview/FinanceExpensesPage'),
    'FinanceExpensesPage'
  )
);
// The Finance rail (unlike Home/Planner/Projects) doesn't mount a TaskDrawer
// anywhere today — clicking a task's expand icon/name on Finance > Expenses
// just set Redux state with nothing rendering it, so the drawer appeared to
// not open at all (or only later, once the user navigated to a page that
// does mount one). Mount it here, scoped to the Finance surface only.
const TaskDrawer = lazy(
  ChunkErrorHandler.wrapLazyImport(() => import('@/components/task-drawer/task-drawer'), 'TaskDrawer')
);

// Define AdminGuard component with defensive programming
const AdminGuard = ({ children }: { children: React.ReactNode }) => {
  const authService = useAuthService();
  const location = useLocation();

  try {
    // Defensive checks to ensure authService and its methods exist
    if (
      !authService ||
      typeof authService.isAuthenticated !== 'function' ||
      typeof authService.isOwnerOrAdmin !== 'function'
    ) {
      // If auth service is not ready, render children (don't block)
      return <>{children}</>;
    }

    if (!authService.isAuthenticated()) {
      return <Navigate to="/auth" state={{ from: location }} replace />;
    }

    if (!authService.isOwnerOrAdmin()) {
      return <Navigate to="/worklenz/unauthorized" replace />;
    }

    return <>{children}</>;
  } catch (error) {
    console.error('Error in AdminGuard (main-routes):', error);
    // On error, render children to prevent complete blocking
    return <>{children}</>;
  }
};

// Define TeamLeadGuard component
const TeamLeadGuard = ({ children }: { children: React.ReactNode }) => {
  const authService = useAuthService();
  const location = useLocation();

  try {
    if (!authService || typeof authService.isAuthenticated !== 'function') {
      return <>{children}</>;
    }

    if (!authService.isAuthenticated()) {
      return <Navigate to="/auth" state={{ from: location }} replace />;
    }

    const currentSession = authService.getCurrentSession();

    // Check if user has Team Lead role using role_name field
    const hasTeamLeadRole = currentSession?.role_name
      ? isTeamLeadRole(currentSession.role_name)
      : false;

    if (!hasTeamLeadRole) {
      return <Navigate to="/worklenz/unauthorized" replace />;
    }

    return <>{children}</>;
  } catch (error) {
    console.error('Error in TeamLeadGuard (main-routes):', error);
    return <>{children}</>;
  }
};

const FINANCE_BASE_PATH = '/worklenz/finance';

// Finance is a business-plan feature. Rather than redirecting users without
// access away entirely, the rail navigation stays visible and the content
// pane shows a blurred preview of whichever page is active — reusing the
// same per-page previews as the "not built yet" placeholders below — with an
// upgrade prompt, matching how Planner gates Schedule/Timeline/Workload.
const FinanceRailLayout = () => {
  const authService = useAuthService();
  const location = useLocation();
  const hasBusinessAccess = hasBusinessFeatureAccess(authService.getCurrentSession());
  const financePreviews = useFinanceFeaturePreviews();

  const activeKey = useMemo(() => {
    const rest = location.pathname.startsWith(FINANCE_BASE_PATH)
      ? location.pathname.slice(FINANCE_BASE_PATH.length).replace(/^\//, '')
      : '';
    return rest || 'overview';
  }, [location.pathname]);

  const lockedPreview = financePreviews[activeKey];

  return (
    <>
      <SimpleRailLayout
        surfaceKey="finance"
        contentOverride={
          hasBusinessAccess ? undefined : (
            <FeatureUpgradePreview key={activeKey} {...(lockedPreview ?? financePreviews.generic)} />
          )
        }
      />
      {createPortal(
        <Suspense fallback={null}>
          <TaskDrawer />
        </Suspense>,
        document.body,
        'finance-task-drawer'
      )}
    </>
  );
};

// Each wrapped in its own component (rather than inline JSX in the route
// config) so it can call the translation hook — route `element`s can't call
// hooks directly.
const FinanceProfitabilityComingSoon = () => {
  const previews = useFinanceFeaturePreviews();
  return <FeatureUpgradePreview {...previews.profitability} showCta={false} />;
};
const FinanceBudgetsComingSoon = () => {
  const previews = useFinanceFeaturePreviews();
  return <FeatureUpgradePreview {...previews.budgets} showCta={false} />;
};
const FinanceInvoicesComingSoon = () => {
  const previews = useFinanceFeaturePreviews();
  return <FeatureUpgradePreview {...previews.invoices} showCta={false} />;
};
const FinanceBillableTimeComingSoon = () => {
  const previews = useFinanceFeaturePreviews();
  return <FeatureUpgradePreview {...previews['billable-time']} showCta={false} />;
};
const FinanceUtilizationComingSoon = () => {
  const previews = useFinanceFeaturePreviews();
  return <FeatureUpgradePreview {...previews.utilization} showCta={false} />;
};
const FinanceForecastsComingSoon = () => {
  const previews = useFinanceFeaturePreviews();
  return <FeatureUpgradePreview {...previews.forecasts} showCta={false} />;
};

const mainRoutes: RouteObject[] = [
  {
    path: '/worklenz',
    element: <MainLayout />,
    children: [
      { index: true, element: <Navigate to="home" replace /> },
      {
        path: 'home',
        element: (
          <GuestRedirect>
            <Suspense fallback={<SuspenseFallback />}>
              <HomeLayout />
            </Suspense>
          </GuestRedirect>
        ),
        children: [
          { index: true, element: <NavSurfaceIndexRedirect surfaceKey="home" /> },
          {
            path: 'overview',
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <HomeOverviewView />
              </Suspense>
            ),
          },
          {
            path: 'my-tasks',
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <HomeMyTasksView />
              </Suspense>
            ),
          },
          {
            path: 'calendar',
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <div
                  style={{
                    padding: '24px',
                    height: '100%',
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <Suspense fallback={<Skeleton active />}>
                    <HomeCalendarView />
                  </Suspense>
                </div>
              </Suspense>
            ),
          },
          {
            path: 'inbox',
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <div style={{ height: '100%' }}>
                  <HomeInboxView />
                </div>
              </Suspense>
            ),
          },
          {
            path: 'log-time',
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <HomeLogTime />
              </Suspense>
            ),
          },
          {
            path: 'todo',
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <div style={{ height: '100%' }}>
                  <HomeTodoList />
                </div>
              </Suspense>
            ),
          },
          {
            path: 'my-team',
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <HomeMyTeam />
              </Suspense>
            ),
          },
          {
            path: 'add-client',
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <HomeAddClient />
              </Suspense>
            ),
          },
        ],
      },
      {
        path: 'projects',
        element: <SimpleRailLayout surfaceKey="projects" />,
        children: [
          {
            index: true,
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <ProjectList />
              </Suspense>
            ),
          },
          {
            path: 'time-entries',
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <TimeEntriesPage />
              </Suspense>
            ),
          },
          {
            path: 'recurring-tasks',
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <RecurringTasksPage />
              </Suspense>
            ),
          },
          {
            path: 'workload',
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <ComingSoonPage title="Workload" icon={<ControlOutlined />} />
              </Suspense>
            ),
          },
          {
            path: 'roadmap',
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <ComingSoonPage title="Roadmap" icon={<CalendarOutlined />} />
              </Suspense>
            ),
          },
          {
            path: 'files',
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <FilesPage />
              </Suspense>
            ),
          },
          {
            path: 'templates',
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <TemplatesPage />
              </Suspense>
            ),
          },
          {
            path: 'archived',
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <ComingSoonPage title="Archived" icon={<InboxOutlined />} />
              </Suspense>
            ),
          },
        ],
      },
      {
        // Time Entries moved under Projects — redirect old bookmarks/links.
        path: 'time-entries',
        element: <Navigate to="/worklenz/projects/time-entries" replace />,
      },
      {
        path: 'team-lead-reports',
        element: <SimpleRailLayout surfaceKey="team-lead-reports" />,
        children: [
          {
            index: true,
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <TeamLeadGuard>
                  <TeamLeadReports />
                </TeamLeadGuard>
              </Suspense>
            ),
          },
        ],
      },
      {
        path: 'planner',
        element: (
          <Suspense fallback={<SuspenseFallback />}>
            <AdminGuard>
              <PlannerLayout />
            </AdminGuard>
          </Suspense>
        ),
        children: [
          { index: true, element: <NavSurfaceIndexRedirect surfaceKey="planner" /> },
          { path: 'schedule', element: <PlannerScheduleView /> },
          { path: 'timeline', element: <PlannerTimelineView /> },
          { path: 'workload', element: <PlannerWorkloadView /> },
        ],
      },
      {
        path: 'schedule',
        element: <Navigate to="/worklenz/planner" replace />,
      },
      {
        path: 't/:taskId',
        element: (
          <Suspense fallback={<SuspenseFallback />}>
            <TaskShortLinkRedirect />
          </Suspense>
        ),
      },
      {
        path: `projects/:projectId`,
        element: (
          <Suspense fallback={<SuspenseFallback />}>
            <ProjectView />
          </Suspense>
        ),
      },
      {
        path: 'unauthorized',
        element: (
          <Suspense fallback={<SuspenseFallback />}>
            <Unauthorized />
          </Suspense>
        ),
      },
      {
        path: 'gantt-demo',
        element: (
          <Suspense fallback={<SuspenseFallback />}>
            <GanttDemoPage />
          </Suspense>
        ),
      },
      {
        path: 'license-expired',
        element: (
          <Suspense fallback={<SuspenseFallback />}>
            <LicenseExpiredPage />
          </Suspense>
        ),
      },
      {
        path: 'finance',
        element: (
          <AdminGuard>
            <FinanceRailLayout />
          </AdminGuard>
        ),
        children: [
          {
            index: true,
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <FinanceOverviewPage />
              </Suspense>
            ),
          },
          {
            path: 'profitability',
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <FinanceProfitabilityComingSoon />
              </Suspense>
            ),
          },
          {
            path: 'budgets',
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <FinanceBudgetsComingSoon />
              </Suspense>
            ),
          },
          {
            path: 'invoices',
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <FinanceInvoicesComingSoon />
              </Suspense>
            ),
          },
          {
            path: 'expenses',
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <FinanceExpensesPage />
              </Suspense>
            ),
          },
          {
            path: 'billable-time',
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <FinanceBillableTimeComingSoon />
              </Suspense>
            ),
          },
          {
            path: 'utilization',
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <FinanceUtilizationComingSoon />
              </Suspense>
            ),
          },
          {
            path: 'forecasts',
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <FinanceForecastsComingSoon />
              </Suspense>
            ),
          },
        ],
      },
      ...settingsRoutes,
      ...adminCenterRoutes,
    ],
  },
];

export default mainRoutes;
