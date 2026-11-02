import { RouteObject } from 'react-router-dom';
import { Suspense } from 'react';
import {
  adminCenterItems,
  canAccessAdminCenter,
  canAccessAdminCenterItem,
  type AdminCenterMenuItems,
} from '@/lib/admin-center-constants';
import { Navigate } from 'react-router-dom';
import { useAuthService } from '@/hooks/useAuth';
import { useOrganizationPermissions } from '@/hooks/useOrganizationPermission';
import { useAuditLogPermissions } from '@/hooks/useAuditLogPermissions';
import { SuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';
import AdminCenterLayout from '@/layouts/AdminCenterLayout';
import { OrganizationPermission } from '@/types/admin-center/permission-schemes.types';

const AdminCenterGuard = ({ children }: { children: React.ReactNode }) => {
  const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();
  const { permissions, isLoading } = useOrganizationPermissions();

  if (isLoading) {
    return <SuspenseFallback />;
  }

  if (!canAccessAdminCenter(isOwnerOrAdmin, permissions)) {
    return <Navigate to="/worklenz/unauthorized" replace />;
  }

  return <>{children}</>;
};

/**
 * Per-page guard for pages that must stay Owner/Admin-only even if the Admin Center as a
 * whole is ever opened to more roles (e.g. Security > Audit Log, Audit log spec).
 */
const OwnerOrAdminRouteGuard = ({ children }: { children: React.ReactNode }) => {
  const { canViewAuditLog } = useAuditLogPermissions();

  if (!canViewAuditLog) {
    return <Navigate to="/worklenz/unauthorized" replace />;
  }

  return <>{children}</>;
};

const AdminCenterItemGuard = ({
  item,
  children,
}: {
  item: AdminCenterMenuItems;
  children: React.ReactNode;
}) => {
  const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();
  const { permissions, isLoading } = useOrganizationPermissions();

  if (isLoading) {
    return <SuspenseFallback />;
  }

  if (!canAccessAdminCenterItem(item, isOwnerOrAdmin, permissions as OrganizationPermission[])) {
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
    children: adminCenterItems.map(item => {
      const page = <Suspense fallback={<SuspenseFallback />}>{item.element}</Suspense>;
      const guarded = item.ownerOrAdminOnly ? (
        <OwnerOrAdminRouteGuard>{page}</OwnerOrAdminRouteGuard>
      ) : (
        <AdminCenterItemGuard item={item}>{page}</AdminCenterItemGuard>
      );
      return {
        path: item.endpoint,
        element: guarded,
      };
    }),
  },
];

export default adminCenterRoutes;
