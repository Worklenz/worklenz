import React, { lazy, Suspense } from 'react';
import { RouteObject } from 'react-router-dom';
import { Spin } from '@/shared/antd-imports';
import ClientPortalLayout from '@/layouts/client-portal-layout';
import ChunkErrorHandler from '@/utils/chunk-error-handler';

// Lazy load all client portal components with chunk error handling
const ClientPortalClients = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/client-portal/clients/ClientPortalClients'),
    'ClientPortalClients'
  )
);
const ClientPortalRequests = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/client-portal/requests/client-portal-requests'),
    'ClientPortalRequests'
  )
);
const ClientPortalRequestDetails = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/client-portal/requests/request-details/client-portal-request-details'),
    'ClientPortalRequestDetails'
  )
);
const ClientPortalServices = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/client-portal/services/client-portal-services'),
    'ClientPortalServices'
  )
);
const ClientPortalAddServices = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/client-portal/services/add-service/ClientPortalAddServices'),
    'ClientPortalAddServices'
  )
);
const ClientPortalEditService = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/client-portal/services/edit-service/client-portal-edit-service'),
    'ClientPortalEditService'
  )
);
const ClientPortalChats = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/client-portal/chats/client-portal-chats'),
    'ClientPortalChats'
  )
);
const ClientPortalSettings = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/client-portal/settings/ClientPortalSettings'),
    'ClientPortalSettings'
  )
);
const ClientPortalInvoices = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/client-portal/invoices/client-portal-invoices'),
    'ClientPortalInvoices'
  )
);
const ClientPortalInvoiceDetails = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/client-portal/invoices/invoice-details/client-portal-invoice-details'),
    'ClientPortalInvoiceDetails'
  )
);
const InvoiceBuilder = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/client-portal/invoices/invoice-builder/invoice-builder'),
    'InvoiceBuilder'
  )
);

const clientPortalRoutes: RouteObject[] = [
  {
    path: 'worklenz/client-portal',
    element: <ClientPortalLayout />,
    children: [
      {
        path: 'clients',
        element: (
          <Suspense
            fallback={<Spin size="large" style={{ display: 'block', margin: '50px auto' }} />}
          >
            <ClientPortalClients />
          </Suspense>
        ),
      },
      {
        path: 'requests',
        element: (
          <Suspense
            fallback={<Spin size="large" style={{ display: 'block', margin: '50px auto' }} />}
          >
            <ClientPortalRequests />
          </Suspense>
        ),
      },
      {
        path: 'requests/:id',
        element: (
          <Suspense
            fallback={<Spin size="large" style={{ display: 'block', margin: '50px auto' }} />}
          >
            <ClientPortalRequestDetails />
          </Suspense>
        ),
      },
      {
        path: 'services',
        element: (
          <Suspense
            fallback={<Spin size="large" style={{ display: 'block', margin: '50px auto' }} />}
          >
            <ClientPortalServices />
          </Suspense>
        ),
      },
      {
        path: 'add-service',
        element: (
          <Suspense
            fallback={<Spin size="large" style={{ display: 'block', margin: '50px auto' }} />}
          >
            <ClientPortalAddServices />
          </Suspense>
        ),
      },
      {
        path: 'edit-service/:id',
        element: (
          <Suspense
            fallback={<Spin size="large" style={{ display: 'block', margin: '50px auto' }} />}
          >
            <ClientPortalEditService />
          </Suspense>
        ),
      },
      {
        path: 'chats',
        element: (
          <Suspense
            fallback={<Spin size="large" style={{ display: 'block', margin: '50px auto' }} />}
          >
            <ClientPortalChats />
          </Suspense>
        ),
      },
      {
        path: 'invoices',
        element: (
          <Suspense
            fallback={<Spin size="large" style={{ display: 'block', margin: '50px auto' }} />}
          >
            <ClientPortalInvoices />
          </Suspense>
        ),
      },
      {
        path: 'invoices/create',
        element: (
          <Suspense
            fallback={<Spin size="large" style={{ display: 'block', margin: '50px auto' }} />}
          >
            <InvoiceBuilder />
          </Suspense>
        ),
      },
      {
        path: 'invoices/:invoiceId/edit',
        element: (
          <Suspense
            fallback={<Spin size="large" style={{ display: 'block', margin: '50px auto' }} />}
          >
            <InvoiceBuilder />
          </Suspense>
        ),
      },
      {
        path: 'invoices/:invoiceId',
        element: (
          <Suspense
            fallback={<Spin size="large" style={{ display: 'block', margin: '50px auto' }} />}
          >
            <ClientPortalInvoiceDetails />
          </Suspense>
        ),
      },
      {
        path: 'settings',
        element: (
          <Suspense
            fallback={<Spin size="large" style={{ display: 'block', margin: '50px auto' }} />}
          >
            <ClientPortalSettings />
          </Suspense>
        ),
      },
    ],
  },
];

export default clientPortalRoutes;
