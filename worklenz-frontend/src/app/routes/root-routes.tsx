import { Navigate, RouteObject } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { SuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';

const OrganizationInvitePage = lazy(() => import('@/pages/client-view/organization-invite/organization-invite'));

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
];

export default rootRoutes;
