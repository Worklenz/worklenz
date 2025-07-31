import React from 'react';
import { RouteObject } from 'react-router-dom';
import ClientPortalLayout from '@/layouts/client-portal-layout';
import ClientPortalClients from '@/pages/client-portal/clients/ClientPortalClients';
import ClientPortalRequests from '@/pages/client-portal/requests/client-portal-requests';
import ClientPortalRequestDetails from '@/pages/client-portal/requests/request-details/client-portal-request-details';
import ClientPortalServices from '@/pages/client-portal/services/client-portal-services';
import ClientPortalAddServices from '@/pages/client-portal/services/add-service/client-portal-add-service';
import ClientPortalEditService from '@/pages/client-portal/services/edit-service/client-portal-edit-service';
import ClientPortalChats from '@/pages/client-portal/chats/client-portal-chats';
import ClientPortalSettings from '@/pages/client-portal/settings/client-portal-settings';
import ClientPortalInvoices from '@/pages/client-portal/invoices/client-portal-invoices';
import ClientPortalInvoiceDetails from '@/pages/client-portal/invoices/invoice-details/client-portal-invoice-details';

const clientPortalRoutes: RouteObject[] = [
  {
    path: 'worklenz/client-portal',
    element: <ClientPortalLayout />,
    children: [
      {
        path: 'clients',
        element: <ClientPortalClients />,
      },
      {
        path: 'requests',
        element: <ClientPortalRequests />,
      },
      {
        path: 'requests/:id',
        element: <ClientPortalRequestDetails />,
      },
      {
        path: 'services',
        element: <ClientPortalServices />,
      },
      {
        path: 'add-service',
        element: <ClientPortalAddServices />,
      },
      {
        path: 'edit-service/:id',
        element: <ClientPortalEditService />,
      },
      {
        path: 'chats',
        element: <ClientPortalChats />,
      },
      {
        path: 'invoices',
        element: <ClientPortalInvoices />,
      },
      {
        path: 'invoices/:invoiceId',
        element: <ClientPortalInvoiceDetails />,
      },
      {
        path: 'settings',
        element: <ClientPortalSettings />,
      },
    ],
  },
];

export default clientPortalRoutes;
