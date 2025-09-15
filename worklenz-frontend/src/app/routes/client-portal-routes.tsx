import React, { lazy, Suspense } from 'react';
import { RouteObject } from 'react-router-dom';
import { Spin } from 'antd';
import ClientPortalLayout from '@/layouts/client-portal-layout';

// Lazy load all client portal components
const ClientPortalClients = lazy(() => import('@/pages/client-portal/clients/ClientPortalClients'));
const ClientPortalRequests = lazy(() => import('@/pages/client-portal/requests/client-portal-requests'));
const ClientPortalRequestDetails = lazy(() => import('@/pages/client-portal/requests/request-details/client-portal-request-details'));
const ClientPortalServices = lazy(() => import('@/pages/client-portal/services/client-portal-services'));
const ClientPortalAddServices = lazy(() => import('@/pages/client-portal/services/add-service/client-portal-add-service'));
const ClientPortalEditService = lazy(() => import('@/pages/client-portal/services/edit-service/client-portal-edit-service'));
const ClientPortalChats = lazy(() => import('@/pages/client-portal/chats/client-portal-chats'));
const ClientPortalSettings = lazy(() => import('@/pages/client-portal/settings/client-portal-settings'));
const ClientPortalInvoices = lazy(() => import('@/pages/client-portal/invoices/client-portal-invoices'));
const ClientPortalInvoiceDetails = lazy(() => import('@/pages/client-portal/invoices/invoice-details/client-portal-invoice-details'));

const clientPortalRoutes: RouteObject[] = [
  {
    path: 'worklenz/client-portal',
    element: <ClientPortalLayout />,
    children: [
      {
        path: 'clients',
        element: (
          <Suspense fallback={<Spin size="large" style={{ display: 'block', margin: '50px auto' }} />}>
            <ClientPortalClients />
          </Suspense>
        ),
      },
      {
        path: 'requests',
        element: (
          <Suspense fallback={<Spin size="large" style={{ display: 'block', margin: '50px auto' }} />}>
            <ClientPortalRequests />
          </Suspense>
        ),
      },
      {
        path: 'requests/:id',
        element: (
          <Suspense fallback={<Spin size="large" style={{ display: 'block', margin: '50px auto' }} />}>
            <ClientPortalRequestDetails />
          </Suspense>
        ),
      },
      {
        path: 'services',
        element: (
          <Suspense fallback={<Spin size="large" style={{ display: 'block', margin: '50px auto' }} />}>
            <ClientPortalServices />
          </Suspense>
        ),
      },
      {
        path: 'add-service',
        element: (
          <Suspense fallback={<Spin size="large" style={{ display: 'block', margin: '50px auto' }} />}>
            <ClientPortalAddServices />
          </Suspense>
        ),
      },
      {
        path: 'edit-service/:id',
        element: (
          <Suspense fallback={<Spin size="large" style={{ display: 'block', margin: '50px auto' }} />}>
            <ClientPortalEditService />
          </Suspense>
        ),
      },
      {
        path: 'chats',
        element: (
          <Suspense fallback={<Spin size="large" style={{ display: 'block', margin: '50px auto' }} />}>
            <ClientPortalChats />
          </Suspense>
        ),
      },
      {
        path: 'invoices',
        element: (
          <Suspense fallback={<Spin size="large" style={{ display: 'block', margin: '50px auto' }} />}>
            <ClientPortalInvoices />
          </Suspense>
        ),
      },
      {
        path: 'invoices/:invoiceId',
        element: (
          <Suspense fallback={<Spin size="large" style={{ display: 'block', margin: '50px auto' }} />}>
            <ClientPortalInvoiceDetails />
          </Suspense>
        ),
      },
      {
        path: 'settings',
        element: (
          <Suspense fallback={<Spin size="large" style={{ display: 'block', margin: '50px auto' }} />}>
            <ClientPortalSettings />
          </Suspense>
        ),
      },
    ],
  },
];

export default clientPortalRoutes;
