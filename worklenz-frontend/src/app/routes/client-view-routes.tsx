import ClientViewLayout from '@/layouts/client-view-layout';
import ClientViewChats from '@/pages/client-view/chat/client-view-chats';
import ClientViewInvoices from '@/pages/client-view/invoices/client-view-invoices';
import ClientViewInvoiceDetails from '@/pages/client-view/invoices/invoice-details/client-view-invoice-details';
import ClientViewProjects from '@/pages/client-view/projects/client-view-projects';
import ClientViewRequests from '@/pages/client-view/requests/client-view-requests';
import ClientViewServices from '@/pages/client-view/services/client-view-service';
import ClientViewServiceDetails from '@/pages/client-view/services/service-details/client-view-service-details';
import { RouteObject } from 'react-router-dom';


const clientViewRoutes: RouteObject[] = [
  {
    path: 'client-view',
    element: <ClientViewLayout />,
    children: [
      {
        path: 'services',
        element: <ClientViewServices />,
      },
      { path: 'services/:id', element: <ClientViewServiceDetails /> },
      { path: 'projects', element: <ClientViewProjects /> },
      { path: 'chats', element: <ClientViewChats /> },
      { path: 'invoices', element: <ClientViewInvoices /> },
      { path: 'invoices/:id', element: <ClientViewInvoiceDetails /> },
      { path: 'requests', element: <ClientViewRequests /> },
    ],
  },
];

export default clientViewRoutes;
