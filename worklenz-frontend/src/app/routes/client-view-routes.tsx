import ClientViewLayout from '@/layouts/client-view-layout';
import ClientViewDashboard from '@/pages/client-view/dashboard/client-view-dashboard';
import ClientViewChats from '@/pages/client-view/chat/client-view-chats';
import ClientViewInvoices from '@/pages/client-view/invoices/client-view-invoices';
import ClientViewInvoiceDetails from '@/pages/client-view/invoices/invoice-details/client-view-invoice-details';
import ClientViewProjects from '@/pages/client-view/projects/client-view-projects';
import ClientViewProjectDetails from '@/pages/client-view/projects/project-details/client-view-project-details';
import ClientViewRequests from '@/pages/client-view/requests/client-view-requests';
import ClientViewRequestDetails from '@/pages/client-view/requests/request-details/client-view-request-details';
import NewRequestForm from '@/pages/client-view/requests/new-request-form';
import ClientViewServices from '@/pages/client-view/services/client-view-service';
import ClientViewServiceDetails from '@/pages/client-view/services/service-details/client-view-service-details';
import ClientViewSettings from '@/pages/client-view/settings/client-view-settings';
import { RouteObject } from 'react-router-dom';

const clientViewRoutes: RouteObject[] = [
  {
    path: 'client-portal',
    element: <ClientViewLayout />,
    children: [
      {
        index: true,
        element: <ClientViewDashboard />,
      },
      {
        path: 'dashboard',
        element: <ClientViewDashboard />,
      },
      {
        path: 'services',
        element: <ClientViewServices />,
      },
      { 
        path: 'services/:id', 
        element: <ClientViewServiceDetails /> 
      },
      {
        path: 'projects',
        element: <ClientViewProjects />,
      },
      { 
        path: 'projects/:id', 
        element: <ClientViewProjectDetails /> 
      },
      {
        path: 'chats',
        element: <ClientViewChats />,
      },
      {
        path: 'invoices',
        element: <ClientViewInvoices />,
      },
      { 
        path: 'invoices/:id', 
        element: <ClientViewInvoiceDetails /> 
      },
      {
        path: 'requests',
        element: <ClientViewRequests />,
      },
      {
        path: 'requests/new',
        element: <NewRequestForm />,
      },
      { 
        path: 'requests/:id', 
        element: <ClientViewRequestDetails /> 
      },
      {
        path: 'settings',
        element: <ClientViewSettings />,
      },
    ],
  },
];

export default clientViewRoutes;
