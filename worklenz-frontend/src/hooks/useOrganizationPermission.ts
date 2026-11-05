import { useGetMyOrganizationPermissionsQuery } from '@/api/admin-center/permission-schemes.api.service';
import { useAuthService } from '@/hooks/useAuth';
import { useAppSelector } from '@/hooks/useAppSelector';
import { OrganizationPermission } from '@/types/admin-center/permission-schemes.types';

interface OrganizationPermissionsState {
  permissions: OrganizationPermission[];
  isLoading: boolean;
}

/** Organization permissions granted to the current user by the team's default permission scheme. */
export const useOrganizationPermissions = (): OrganizationPermissionsState => {
  const authService = useAuthService();
  // Subscribing to the auth user re-reads the session after login or team switch
  useAppSelector(state => state.auth.user);
  const teamId = authService.isAuthenticated() ? authService.getCurrentSession()?.team_id : undefined;

  const { data: permissions = [], isLoading } = useGetMyOrganizationPermissionsQuery(teamId ?? '', {
    skip: !teamId,
  });

  return { permissions, isLoading };
};

export const useOrganizationPermission = (permission: OrganizationPermission) => {
  const { permissions, isLoading } = useOrganizationPermissions();
  return { hasPermission: permissions.includes(permission), isLoading };
};
