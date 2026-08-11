import { RouteObject } from 'react-router-dom';
import { Suspense } from 'react';
import { adminCenterItems } from '@/lib/admin-center-constants';
import { Navigate } from 'react-router-dom';
import { useAuthService } from '@/hooks/useAuth';
import { SuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';
import AdminCenterLayout from '@/layouts/AdminCenterLayout';
import { ISUBSCRIPTION_TYPE } from '@/shared/constants';

const AdminCenterGuard = ({ children }: { children: React.ReactNode }) => {
  const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();

  if (!isOwnerOrAdmin) {
    return <Navigate to="/worklenz/unauthorized" replace />;
  }

  return <>{children}</>;
};

// Mirrors the sidebar's selfHostedExcluded/selfHostedOnly filtering (sidebar.tsx), but for the
// routes themselves — hiding the nav link isn't enough since these routes stay directly
// navigable by URL otherwise.
const AdminCenterItemGuard = ({
  selfHostedExcluded,
  selfHostedOnly,
  children,
}: {
  selfHostedExcluded?: boolean;
  selfHostedOnly?: boolean;
  children: React.ReactNode;
}) => {
  const currentSession = useAuthService().getCurrentSession();
  const isSelfHosted = currentSession?.subscription_type === ISUBSCRIPTION_TYPE.SELF_HOSTED;

  if (selfHostedExcluded && isSelfHosted) {
    return <Navigate to="/worklenz/admin-center/overview" replace />;
  }
  if (selfHostedOnly && !isSelfHosted) {
    return <Navigate to="/worklenz/admin-center/overview" replace />;
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
      element: (
        <AdminCenterItemGuard selfHostedExcluded={item.selfHostedExcluded} selfHostedOnly={item.selfHostedOnly}>
          <Suspense fallback={<SuspenseFallback />}>{item.element}</Suspense>
        </AdminCenterItemGuard>
      ),
    })),
  },
];

export default adminCenterRoutes;
