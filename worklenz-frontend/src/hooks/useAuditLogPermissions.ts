import { useAuthService } from '@/hooks/useAuth';
import { ROLE_NAMES } from '@/types/roles/role.types';
import { getSessionRoleName } from '@/utils/role-permissions.utils';

interface IAuditLogPermissions {
  /** Owner/Admin — mirrors the backend's auditLogAccessValidator. */
  canViewAuditLog: boolean;
  /** Owner only — mirrors the backend's auditLogOwnerValidator. */
  canEditRetention: boolean;
}

export const useAuditLogPermissions = (): IAuditLogPermissions => {
  const authService = useAuthService();
  const isOwner = getSessionRoleName(authService.getCurrentSession()) === ROLE_NAMES.OWNER;

  return {
    canViewAuditLog: authService.isOwnerOrAdmin(),
    canEditRetention: isOwner,
  };
};
