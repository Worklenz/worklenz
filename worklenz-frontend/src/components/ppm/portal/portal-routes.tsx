import React, { lazy, Suspense } from 'react';
import { RouteObject, Navigate } from 'react-router-dom';
import { Spin, Flex } from 'antd';
import { PortalProvider } from './portal-context';
import PortalLayout from './PortalLayout';

const PortalLoginPage = lazy(() => import('./PortalLoginPage'));
const PortalDeliverablesPage = lazy(() => import('./PortalDeliverablesPage'));
const PortalDeliverableDetailPage = lazy(() => import('./PortalDeliverableDetailPage'));

const Fallback = () => (
  <Flex align="center" justify="center" style={{ minHeight: '100vh' }}>
    <Spin size="large" />
  </Flex>
);

const portalRoutes: RouteObject[] = [
  {
    path: '/portal',
    element: (
      <PortalProvider>
        <PortalLayout />
      </PortalProvider>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/portal/login" replace />,
      },
      {
        path: 'login',
        element: (
          <Suspense fallback={<Fallback />}>
            <PortalLoginPage />
          </Suspense>
        ),
      },
      {
        path: 'deliverables',
        element: (
          <Suspense fallback={<Fallback />}>
            <PortalDeliverablesPage />
          </Suspense>
        ),
      },
      {
        path: 'deliverables/:id',
        element: (
          <Suspense fallback={<Fallback />}>
            <PortalDeliverableDetailPage />
          </Suspense>
        ),
      },
    ],
  },
];

export default portalRoutes;
