import { RouteObject } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import MainLayout from '@/layouts/MainLayout';
import settingsRoutes from './settings-routes';
import adminCenterRoutes from './admin-center-routes';
import { useAuthService } from '@/hooks/useAuth';
import { Navigate, useLocation } from 'react-router-dom';
import { SuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';
import ChunkErrorHandler from '@/utils/chunk-error-handler';
import { isTeamLeadRole } from '@/types/roles/role.types';

// Lazy load page components for better code splitting with chunk error handling
const HomePage = lazy(
  ChunkErrorHandler.wrapLazyImport(() => import('@/pages/home/HomePage'), 'HomePage')
);
const ProjectList = lazy(
  ChunkErrorHandler.wrapLazyImport(() => import('@/pages/projects/project-list'), 'ProjectList')
);
const Schedule = lazy(
  ChunkErrorHandler.wrapLazyImport(() => import('@/pages/schedule/schedule'), 'Schedule')
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
    () => import('@/pages/license-expired/LicenseExpired'),
    'LicenseExpiredPage'
  )
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

const mainRoutes: RouteObject[] = [
  {
    path: '/worklenz',
    element: <MainLayout />,
    children: [
      { index: true, element: <Navigate to="home" replace /> },
      {
        path: 'home',
        element: (
          <Suspense fallback={<SuspenseFallback />}>
            <HomePage />
          </Suspense>
        ),
      },
      {
        path: 'projects',
        element: (
          <Suspense fallback={<SuspenseFallback />}>
            <ProjectList />
          </Suspense>
        ),
      },
      {
        path: 'team-lead-reports',
        element: (
          <Suspense fallback={<SuspenseFallback />}>
            <TeamLeadGuard>
              <TeamLeadReports />
            </TeamLeadGuard>
          </Suspense>
        ),
      },
      {
        path: 'schedule',
        element: (
          <Suspense fallback={<SuspenseFallback />}>
            <AdminGuard>
              <Schedule />
            </AdminGuard>
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
      ...settingsRoutes,
      ...adminCenterRoutes,
    ],
  },
];

export default mainRoutes;
