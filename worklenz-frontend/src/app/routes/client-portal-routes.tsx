import React, { lazy, Suspense } from 'react';
import { RouteObject } from 'react-router-dom';
import { Spin } from '@/shared/antd-imports';
import ClientPortalLayout from '@/layouts/client-portal-layout';
import ChunkErrorHandler from '@/utils/chunk-error-handler';
import NavSurfaceIndexRedirect from '@/features/navigation/NavSurfaceIndexRedirect';

// Lazy load all client portal components with chunk error handling
const OverviewPage = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/client-portal/overview/OverviewPage'),
    'OverviewPage'
  )
);
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
const PortalProjectsPage = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/client-portal/portal-projects/PortalProjectsPage'),
    'PortalProjectsPage'
  )
);
const ProjectWorkspacePage = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/client-portal/portal-projects/ProjectWorkspacePage'),
    'ProjectWorkspacePage'
  )
);
const DiscussionsPage = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/client-portal/discussions/DiscussionsPage'),
    'DiscussionsPage'
  )
);
const ApprovalsPage = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/client-portal/approvals/ApprovalsPage'),
    'ApprovalsPage'
  )
);
const CreateApprovalModal = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () =>
      import('@/pages/client-portal/approvals/CreateApprovalModal').then(module => ({
        default: module.CreateApprovalModal,
      })),
    'CreateApprovalModal'
  )
);
const ApprovalDetailModal = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () =>
      import('@/pages/client-portal/approvals/ApprovalDetailModal').then(module => ({
        default: module.ApprovalDetailModal,
      })),
    'ApprovalDetailModal'
  )
);
const ChangeRequestsPage = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/client-portal/change-requests/ChangeRequestsPage'),
    'ChangeRequestsPage'
  )
);
const ChangeRequestDetailModal = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () =>
      import('@/pages/client-portal/change-requests/ChangeRequestDetailModal').then(module => ({
        default: module.ChangeRequestDetailModal,
      })),
    'ChangeRequestDetailModal'
  )
);
const AuditLogPage = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/client-portal/audit-log/AuditLogPage'),
    'AuditLogPage'
  )
);
const ClientPortalPreviewPage = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/client-portal/preview/ClientPortalPreviewPage'),
    'ClientPortalPreviewPage'
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

const suspended = (node: React.ReactNode) => (
  <Suspense fallback={<Spin size="large" style={{ display: 'block', margin: '50px auto' }} />}>
    {node}
  </Suspense>
);

const clientPortalRoutes: RouteObject[] = [
  {
    path: 'worklenz/client-portal',
    element: <ClientPortalLayout />,
    children: [
      { index: true, element: <NavSurfaceIndexRedirect surfaceKey="client-portal" /> },
      { path: 'overview', element: suspended(<OverviewPage />) },
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
        // One project opens as a modal over the list, like a client. The optional tab segment picks the open tab.
        path: 'projects',
        element: suspended(<PortalProjectsPage />),
        children: [
          { path: ':projectId', element: suspended(<ProjectWorkspacePage />) },
          { path: ':projectId/:tab', element: suspended(<ProjectWorkspacePage />) },
        ],
      },
      {
        // Create and detail are modals opened over the list, like invoices: a direct or shared link still
        // works because the list (this route's parent) renders underneath.
        path: 'approvals',
        element: suspended(<ApprovalsPage />),
        children: [
          { path: 'new', element: suspended(<CreateApprovalModal />) },
          { path: ':approvalId', element: suspended(<ApprovalDetailModal />) },
        ],
      },
      {
        path: 'change-requests',
        element: suspended(<ChangeRequestsPage />),
        children: [{ path: ':changeRequestId', element: suspended(<ChangeRequestDetailModal />) }],
      },
      { path: 'audit-log', element: suspended(<AuditLogPage />) },
      { path: 'preview', element: suspended(<ClientPortalPreviewPage />) },
      { path: 'discussions', element: suspended(<DiscussionsPage />) },
      { path: 'discussions/:threadId', element: suspended(<DiscussionsPage />) },
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
