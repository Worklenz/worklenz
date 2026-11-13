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

  const { currentData, isFetching } = useGetMyOrganizationPermissionsQuery(teamId ?? '', {
    skip: !teamId,
  });

  // currentData is empty while a new team is loading, so a previous team's grants cannot leak.
  const permissions = currentData ?? [];
  const isLoading = Boolean(teamId) && currentData === undefined && isFetching;

  return { permissions, isLoading };
};

/** Whether the current user holds one organization permission from the active team. */
export const useOrganizationPermission = (permission: OrganizationPermission) => {
  const { permissions, isLoading } = useOrganizationPermissions();
  return { hasPermission: permissions.includes(permission), isLoading };
};
