import { RouteObject } from 'react-router-dom';
import { Suspense } from 'react';
import { adminCenterItems } from '@/lib/admin-center-constants';
import { Navigate } from 'react-router-dom';
import { useAuthService } from '@/hooks/useAuth';
import { SuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';
import AdminCenterLayout from '@/layouts/AdminCenterLayout';

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
      element: <Suspense fallback={<SuspenseFallback />}>{item.element}</Suspense>,
    })),
  },
];

export default adminCenterRoutes;
