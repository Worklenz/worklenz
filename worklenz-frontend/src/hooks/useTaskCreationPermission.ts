import { useMemo } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAuthService } from '@/hooks/useAuth';
import { hasBusinessFeatureAccess } from '@/ee/utils/subscription-utils';
import { getSessionRoleName } from '@/utils/role-permissions.utils';
import { ROLE_NAMES } from '@/types/roles/role.types';

/**
 * Returns whether the current user can create and assign tasks in the current project.
 *
 * Rules (Business Plan only):
 *  - If the feature is not on a Business plan, everyone can create tasks.
 *  - If project-level `restrict_task_creation` is TRUE on Business Plan → only Admins/Owners/Team Leads can create.
 *  - If org-level restriction is active → same rule.
 *
 * The hook returns:
 *  - `canCreateTask`  — whether the current user may create/assign tasks
 *  - `isRestricted`   — whether the restriction toggle is active (regardless of user role)
 */
export interface ITaskCreationPermission {
  canCreateTask: boolean;
  isRestricted: boolean;
}

const useTaskCreationPermission = (
  /** Pass an explicit project override when outside the Redux project context */
  projectOverride?: { restrict_task_creation?: boolean } | null
): ITaskCreationPermission => {
  const auth = useAuthService();
  const session = auth.getCurrentSession();
  const reduxProject = useAppSelector(state => state.projectReducer.project);
  const orgConfig = useAppSelector(state => state.orgConfigReducer);

  return useMemo<ITaskCreationPermission>(() => {
    const project = projectOverride !== undefined ? projectOverride : reduxProject;

    // If not on a Business plan, no restrictions apply
    if (!hasBusinessFeatureAccess(session)) {
      return { canCreateTask: true, isRestricted: false };
    }

    // Determine effective restriction:
    // Project-level overrides org-level when explicitly set.
    const projectRestricted = project?.restrict_task_creation ?? false;
    const orgRestricted = orgConfig?.restrict_task_creation ?? false;
    const isRestricted = projectRestricted || orgRestricted;

    if (!isRestricted) {
      return { canCreateTask: true, isRestricted: false };
    }

    // Restriction is active — check if user is Admin/Owner/Team Lead
    const roleName = getSessionRoleName(session);
    const isPrivileged =
      roleName === ROLE_NAMES.OWNER ||
      roleName === ROLE_NAMES.ADMIN ||
      roleName === ROLE_NAMES.TEAM_LEAD;

    return { canCreateTask: isPrivileged, isRestricted: true };
  }, [session, reduxProject, orgConfig, projectOverride]);
};

export default useTaskCreationPermission;
