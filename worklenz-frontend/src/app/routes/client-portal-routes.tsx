import React, { lazy, Suspense } from 'react';
import { RouteObject } from 'react-router-dom';
import { Spin } from '@/shared/antd-imports';
import ClientPortalLayout from '@/layouts/client-portal-layout';
import ChunkErrorHandler from '@/utils/chunk-error-handler';
import NavSurfaceIndexRedirect from '@/features/navigation/NavSurfaceIndexRedirect';

// Lazy load all client portal components with chunk error handling
const ClientPortalClients = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/client-portal/clients/ClientPortalClients'),
    'ClientPortalClients'
  )
);
const ClientWorkspacePage = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/client-portal/clients/workspace/ClientWorkspacePage'),
    'ClientWorkspacePage'
  )
);
const ClientPortalRequests = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/client-portal/requests/client-portal-requests'),
    'ClientPortalRequests'
  )
);
const RequestDetailModal = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/client-portal/requests/request-details/RequestDetailModal'),
    'RequestDetailModal'
  )
);
const ClientPortalServices = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/client-portal/services/client-portal-services'),
    'ClientPortalServices'
  )
);
const ServiceModal = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/client-portal/services/ServiceModal'),
    'ServiceModal'
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
const InvoiceDetailModal = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/client-portal/invoices/InvoiceDetailModal'),
    'InvoiceDetailModal'
  )
);
const CreateInvoiceModal = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/client-portal/invoices/CreateInvoiceModal'),
    'CreateInvoiceModal'
  )
);
const ClientPortalQuotes = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/client-portal/quotes/client-portal-quotes'),
    'ClientPortalQuotes'
  )
);
const QuoteDetailModal = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/client-portal/quotes/QuoteDetailModal'),
    'QuoteDetailModal'
  )
);
const CreateQuoteModal = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/client-portal/quotes/CreateQuoteModal'),
    'CreateQuoteModal'
  )
);
const ClientPortalTickets = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/client-portal/tickets/client-portal-tickets'),
    'ClientPortalTickets'
  )
);
const TicketDetailModal = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/client-portal/tickets/ticket-details/TicketDetailModal'),
    'TicketDetailModal'
  )
);

const clientPortalRoutes: RouteObject[] = [
  {
    path: 'worklenz/client-portal',
    element: <ClientPortalLayout />,
    children: [
      { index: true, element: <NavSurfaceIndexRedirect surfaceKey="client-portal" /> },
      {
        path: 'clients',
        element: (
          <Suspense
            fallback={<Spin size="large" style={{ display: 'block', margin: '50px auto' }} />}
          >
            <ClientPortalClients />
          </Suspense>
        ),
        children: [
          {
            // One workspace per client, opened as a modal over the list. Every way of
            // opening a client links here, and a direct/shared link still works: the
            // list (this route's parent) renders underneath it either way.
            path: ':id',
            element: (
              <Suspense
                fallback={<Spin size="large" style={{ display: 'block', margin: '50px auto' }} />}
              >
                <ClientWorkspacePage />
              </Suspense>
            ),
          },
        ],
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
        children: [
          {
            // One modal per request, opened over the list. Every way of opening a request
            // links here, and a direct/shared link still works: the list (this route's
            // parent) renders underneath it either way.
            path: ':id',
            element: (
              <Suspense
                fallback={<Spin size="large" style={{ display: 'block', margin: '50px auto' }} />}
              >
                <RequestDetailModal />
              </Suspense>
            ),
          },
        ],
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
        children: [
          {
            // Create / edit are modals opened over the list. Every way of opening a service
            // links here, and a direct/shared link still works: the list (this route's parent)
            // renders underneath it either way.
            path: 'create',
            element: (
              <Suspense
                fallback={<Spin size="large" style={{ display: 'block', margin: '50px auto' }} />}
              >
                <ServiceModal />
              </Suspense>
            ),
          },
          {
            path: ':id/edit',
            element: (
              <Suspense
                fallback={<Spin size="large" style={{ display: 'block', margin: '50px auto' }} />}
              >
                <ServiceModal />
              </Suspense>
            ),
          },
        ],
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
        children: [
          {
            // Create / edit / view are modals opened over the list. Every way of opening an
            // invoice links here, and a direct/shared link still works: the list (this route's
            // parent) renders underneath it either way.
            path: 'create',
            element: (
              <Suspense
                fallback={<Spin size="large" style={{ display: 'block', margin: '50px auto' }} />}
              >
                <CreateInvoiceModal />
              </Suspense>
            ),
          },
          {
            path: ':invoiceId/edit',
            element: (
              <Suspense
                fallback={<Spin size="large" style={{ display: 'block', margin: '50px auto' }} />}
              >
                <CreateInvoiceModal />
              </Suspense>
            ),
          },
          {
            path: ':invoiceId',
            element: (
              <Suspense
                fallback={<Spin size="large" style={{ display: 'block', margin: '50px auto' }} />}
              >
                <InvoiceDetailModal />
              </Suspense>
            ),
          },
        ],
      },
      {
        path: 'quotes',
        element: (
          <Suspense
            fallback={<Spin size="large" style={{ display: 'block', margin: '50px auto' }} />}
          >
            <ClientPortalQuotes />
          </Suspense>
        ),
        children: [
          {
            // Create / view are modals opened over the list, like invoices. A direct or shared
            // link still works: the list (this route's parent) renders underneath it.
            path: 'create',
            element: (
              <Suspense
                fallback={<Spin size="large" style={{ display: 'block', margin: '50px auto' }} />}
              >
                <CreateQuoteModal />
              </Suspense>
            ),
          },
          {
            path: ':quoteId',
            element: (
              <Suspense
                fallback={<Spin size="large" style={{ display: 'block', margin: '50px auto' }} />}
              >
                <QuoteDetailModal />
              </Suspense>
            ),
          },
        ],
      },
      {
        path: 'ticketing',
        element: (
          <Suspense
            fallback={<Spin size="large" style={{ display: 'block', margin: '50px auto' }} />}
          >
            <ClientPortalTickets />
          </Suspense>
        ),
        children: [
          {
            // One modal per ticket, opened over the list/board. Every way of opening a
            // ticket links here, and a direct/shared link still works: the queue (this
            // route's parent) renders underneath it either way.
            path: ':id',
            element: (
              <Suspense
                fallback={<Spin size="large" style={{ display: 'block', margin: '50px auto' }} />}
              >
                <TicketDetailModal />
              </Suspense>
            ),
          },
        ],
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
