import React, { lazy, Suspense } from 'react';
import { RouteObject, Navigate } from 'react-router-dom';
import { Spin, Flex } from 'antd';
import { PortalProvider } from './portal-context';
import PortalLayout from './PortalLayout';

const PortalLoginPage = lazy(() => import('./PortalLoginPage'));
const PortalDeliverablesPage = lazy(() => import('./PortalDeliverablesPage'));
const PortalDeliverableDetailPage = lazy(() => import('./PortalDeliverableDetailPage'));
// PPM-OVERRIDE: Phase 2 — portal board view and task detail
const PortalBoardView = lazy(() => import('./PortalBoardView'));
const PortalTaskDetail = lazy(() => import('./PortalTaskDetail'));

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
      // Phase 2: Task board view and task detail
      {
        path: 'tasks',
        element: (
          <Suspense fallback={<Fallback />}>
            <PortalBoardView />
          </Suspense>
        ),
      },
      {
        path: 'tasks/:id',
        element: (
          <Suspense fallback={<Fallback />}>
            <PortalTaskDetail />
          </Suspense>
        ),
      },
    ],
  },
];

export default portalRoutes;
