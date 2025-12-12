import { Navigate, RouteObject } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { SuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';

const OrganizationInvitePage = lazy(
  () => import('@/pages/client-view/organization-invite/organization-invite')
);

const TeamInvitePage = lazy(
  () => import('@/pages/invite/team/TeamInvitePage')
);

const ProjectInvitePage = lazy(
  () => import('@/pages/invite/project/ProjectInvitePage')
);

const rootRoutes: RouteObject[] = [
  {
    path: '/',
    element: <Navigate to="/auth/login" replace />,
  },
  {
    path: '/organization-invite',
    element: (
      <Suspense fallback={<SuspenseFallback />}>
        <OrganizationInvitePage />
      </Suspense>
    ),
  },
  {
    path: '/invite/team/:token',
    element: (
      <Suspense fallback={<SuspenseFallback />}>
        <TeamInvitePage />
      </Suspense>
    ),
  },
  {
    path: '/invite/project/:token',
    element: (
      <Suspense fallback={<SuspenseFallback />}>
        <ProjectInvitePage />
      </Suspense>
    ),
  },
];

export default rootRoutes;
