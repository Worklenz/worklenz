import { RouteObject } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import MainLayout from '@/layouts/MainLayout';
import settingsRoutes from './settings-routes';
import adminCenterRoutes from './admin-center-routes';
import { useAuthService } from '@/hooks/useAuth';
import { Navigate, useLocation } from 'react-router-dom';
import { SuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';

// Lazy load page components for better code splitting
const HomePage = lazy(() => import('@/pages/home/home-page'));
const ProjectList = lazy(() => import('@/pages/projects/project-list'));
const Schedule = lazy(() => import('@/pages/schedule/schedule'));
const ProjectTemplateEditView = lazy(
  () => import('@/pages/settings/project-templates/projectTemplateEditView/ProjectTemplateEditView')
);
const LicenseExpired = lazy(() => import('@/pages/license-expired/license-expired'));
const ProjectView = lazy(() => import('@/pages/projects/projectView/project-view'));
const Unauthorized = lazy(() => import('@/pages/unauthorized/unauthorized'));

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
        path: `settings/project-templates/edit/:templateId/:templateName`,
        element: (
          <Suspense fallback={<SuspenseFallback />}>
            <ProjectTemplateEditView />
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
      ...settingsRoutes,
      ...adminCenterRoutes,
    ],
  },
];

// License expired route should be separate to avoid being wrapped in LicenseExpiryGuard
export const licenseExpiredRoute: RouteObject = {
  path: '/worklenz',
  element: <MainLayout />,
  children: [
    {
      path: 'license-expired',
      element: (
        <Suspense fallback={<SuspenseFallback />}>
          <LicenseExpired />
        </Suspense>
      ),
    },
  ],
};

export default mainRoutes;
