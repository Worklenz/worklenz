import { RouteObject } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import HomePage from '@/pages/home/home-page';
import ProjectList from '@/pages/projects/project-list';
import settingsRoutes from './settings-routes';
import adminCenterRoutes from './admin-center-routes';
import Schedule from '@/pages/schedule/schedule';
import ProjectTemplateEditView from '@/pages/settings/project-templates/projectTemplateEditView/ProjectTemplateEditView';
import LicenseExpired from '@/pages/license-expired/license-expired';
import ProjectView from '@/pages/projects/projectView/project-view';
import Unauthorized from '@/pages/unauthorized/unauthorized';
import { useAuthService } from '@/hooks/useAuth';
import { Navigate, useLocation } from 'react-router-dom';

// Define AdminGuard component first
const AdminGuard = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthService().isAuthenticated();
  const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (!isOwnerOrAdmin) {
    return <Navigate to="/worklenz/unauthorized" replace />;
  }

  return <>{children}</>;
};

const mainRoutes: RouteObject[] = [
  {
    path: '/worklenz',
    element: <MainLayout />,
    children: [
      { index: true, element: <Navigate to="home" replace /> },
      { path: 'home', element: <HomePage /> },
      { path: 'projects', element: <ProjectList /> },
      {
        path: 'schedule',
        element: <AdminGuard><Schedule /></AdminGuard>
      },
      { path: `projects/:projectId`, element: <ProjectView /> },
      {
        path: `settings/project-templates/edit/:templateId/:templateName`,
        element: <ProjectTemplateEditView />,
      },
      { path: 'unauthorized', element: <Unauthorized /> },
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
    { path: 'license-expired', element: <LicenseExpired /> }
  ]
};

export default mainRoutes;
