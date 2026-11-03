import { useGetMyDefaultProjectPermissionsQuery } from '@/api/admin-center/permission-schemes.api.service';
import { useAuthService } from '@/hooks/useAuth';
import { useAppSelector } from '@/hooks/useAppSelector';
import { ProjectRolePermission } from '@/types/admin-center/permission-schemes.types';

interface DefaultProjectPermissionsState {
  permissions: ProjectRolePermission[];
  isLoading: boolean;
}

/** Project permissions from the team's default scheme for the current user's role. */
export const useDefaultProjectPermissions = (): DefaultProjectPermissionsState => {
  const authService = useAuthService();
  useAppSelector(state => state.auth.user);
  const teamId = authService.isAuthenticated()
    ? authService.getCurrentSession()?.team_id
    : undefined;

  const { data: permissions = [], isLoading } = useGetMyDefaultProjectPermissionsQuery(
    teamId ?? '',
    { skip: !teamId }
  );

  return { permissions, isLoading };
};

export const useDefaultProjectPermission = (permission: ProjectRolePermission) => {
  const { permissions, isLoading } = useDefaultProjectPermissions();
  return { hasPermission: permissions.includes(permission), isLoading };
};
