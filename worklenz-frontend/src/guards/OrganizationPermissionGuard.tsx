import { memo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStatus } from '@/hooks/useAuthStatus';
import { useOrganizationPermission } from '@/hooks/useOrganizationPermission';
import { SuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';
import { OrganizationPermission } from '@/types/admin-center/permission-schemes.types';

interface OrganizationPermissionGuardProps {
  permission: OrganizationPermission;
  /** Free-plan surfaces show their own upgrade previews, so blocking is opt-in. */
  blockFreePlan?: boolean;
  children: React.ReactNode;
}

/** Route guard for surfaces granted through the team's default permission scheme. */
export const OrganizationPermissionGuard = memo(
  ({ permission, blockFreePlan = false, children }: OrganizationPermissionGuardProps) => {
    const { isAuthenticated, isFreePlan, location } = useAuthStatus();
    const { hasPermission, isLoading } = useOrganizationPermission(permission);

    if (!isAuthenticated) {
      return <Navigate to="/auth" state={{ from: location }} replace />;
    }

    if (isLoading) return <SuspenseFallback />;

    if (!hasPermission || (blockFreePlan && isFreePlan)) {
      return <Navigate to="/worklenz/unauthorized" replace />;
    }

    return <>{children}</>;
  }
);

OrganizationPermissionGuard.displayName = 'OrganizationPermissionGuard';
