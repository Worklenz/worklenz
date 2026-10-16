import { Navigate, RouteObject } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { SuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';
import ChunkErrorHandler from '@/utils/chunk-error-handler';

const OrganizationInvitePage = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/client-view/organization-invite/organization-invite'),
    'OrganizationInvitePage'
  )
);

const TeamInvitePage = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/invite/team/TeamInvitePage'),
    'TeamInvitePage'
  )
);

const ProjectInvitePage = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/invite/project/ProjectInvitePage'),
    'ProjectInvitePage'
  )
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
