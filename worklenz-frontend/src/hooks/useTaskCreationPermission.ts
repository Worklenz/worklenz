import { useMemo } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAuthService } from '@/hooks/useAuth';
import { hasBusinessFeatureAccess } from '@/ee/utils/subscription-utils';
import { getSessionRoleName } from '@/utils/role-permissions.utils';
import { ROLE_NAMES } from '@/types/roles/role.types';
import { ILocalSession } from '@/types/auth/local-session.types';

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

export interface IProjectTaskCreationContext {
  restrict_task_creation?: boolean;
  is_guest?: boolean;
}

/**
 * Pure helper (no React hooks) — usable in unit tests and non-hook contexts.
 */
export const getTaskCreationPermission = ({
  session,
  project,
  orgConfig,
}: {
  session: ILocalSession | null | undefined;
  project?: { restrict_task_creation?: boolean; is_guest?: boolean } | null;
  orgConfig?: { restrict_task_creation?: boolean } | null;
}): ITaskCreationPermission => {
  // Guests can never create tasks, but this is not a "restriction" toggle.
  if (project?.is_guest) {
    return { canCreateTask: false, isRestricted: false };
  }

  // If not on a Business plan, no restrictions apply
  if (!hasBusinessFeatureAccess(session ?? null)) {
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
  const roleName = getSessionRoleName(session ?? null);
  const isPrivileged =
    roleName === ROLE_NAMES.OWNER ||
    roleName === ROLE_NAMES.ADMIN ||
    roleName === ROLE_NAMES.TEAM_LEAD;

  return { canCreateTask: isPrivileged, isRestricted: true };
};

const useTaskCreationPermission = (
  /** Pass an explicit project override when outside the Redux project context */
  projectOverride?: IProjectTaskCreationContext | null
): ITaskCreationPermission => {
  const auth = useAuthService();
  const session = auth.getCurrentSession();
  const reduxProject = useAppSelector(state => state.projectReducer.project);
  const orgConfig = useAppSelector(state => state.orgConfigReducer);

  return useMemo<ITaskCreationPermission>(() => {
    const project = projectOverride !== undefined ? projectOverride : reduxProject;
    return getTaskCreationPermission({ session, project, orgConfig });
  }, [session, reduxProject, orgConfig, projectOverride]);
};

export default useTaskCreationPermission;
