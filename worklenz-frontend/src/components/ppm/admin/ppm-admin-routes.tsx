// PPM-OVERRIDE: Phase 2 — Admin routes for PPM partner dashboard
import React, { lazy, Suspense } from 'react';
import { RouteObject } from 'react-router-dom';
import { SuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';

const MasterDashboard = lazy(() => import('./MasterDashboard'));
const ApprovalQueue = lazy(() => import('./ApprovalQueue'));
const InternalKanban = lazy(() => import('./InternalKanban'));
const ClientSettingsPage = lazy(() => import('./ClientSettingsPage'));
const ClientListPage = lazy(() => import('./ClientListPage'));

const wrap = (Component: React.LazyExoticComponent<React.ComponentType<any>>) => (
  <Suspense fallback={<SuspenseFallback />}>
    <Component />
  </Suspense>
);

const ppmAdminRoutes: RouteObject[] = [
  { path: 'ppm', element: wrap(MasterDashboard) },
  { path: 'ppm/approvals', element: wrap(ApprovalQueue) },
  { path: 'ppm/pipeline', element: wrap(InternalKanban) },
  { path: 'ppm/clients', element: wrap(ClientListPage) },
  { path: 'ppm/clients/:clientId', element: wrap(ClientSettingsPage) },
];

export default ppmAdminRoutes;
