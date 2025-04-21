import { RouteObject } from 'react-router-dom';
import AdminCenterLayout from '@/layouts/admin-center-layout';
import { adminCenterItems } from '@/pages/admin-center/admin-center-constants';
import { Navigate } from 'react-router-dom';
import { useAuthService } from '@/hooks/useAuth';

const AdminCenterGuard = ({ children }: { children: React.ReactNode }) => {
  const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();

  if (!isOwnerOrAdmin) {
    return <Navigate to="/worklenz/unauthorized" replace />;
  }

  return <>{children}</>;
};

const adminCenterRoutes: RouteObject[] = [
  {
    path: 'admin-center',
    element: (
      <AdminCenterGuard>
        <AdminCenterLayout />
      </AdminCenterGuard>
    ),
    children: adminCenterItems.map(item => ({
      path: item.endpoint,
      element: item.element,
    })),
  },
];

export default adminCenterRoutes;
