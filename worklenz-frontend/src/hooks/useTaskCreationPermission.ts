import { useMemo } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAuthService } from '@/hooks/useAuth';
import { canUseFeature } from '@/utils/subscription-utils';
import { getSessionRoleName } from '@/utils/role-permissions.utils';
import { ROLE_NAMES } from '@/types/roles/role.types';
import { ILocalSession } from '@/types/auth/local-session.types';
import { IProjectRolePermissions } from '@/types/project/projectViewModel.types';
import {
  canCreateProjectTasks,
  isProjectTaskEditingReadOnly,
} from '@/lib/project/project-view-guest';

/**
 * Returns whether the current user can modify and add tasks in the current project.
 *
 * Rules:
 *  - Modifying/assigning tasks needs "Edit tasks" from the project's permission scheme.
 *  - Adding new tasks (and subtasks, duplicates, copies) needs "Create tasks".
 *
 * Restriction rules (Business Plan only), applied to both:
 *  - If the feature is not on a Business plan, no further restriction applies.
 *  - If project-level `restrict_task_creation` is TRUE on Business Plan → only Admins/Owners/Team Leads can create.
 *  - If org-level restriction is active → same rule.
 *
 * The hook returns:
 *  - `canCreateTask`  — whether the current user may modify/assign tasks
 *  - `canAddTask`     — whether the current user may add new tasks
 *  - `isRestricted`   — whether the restriction toggle is active (regardless of user role)
 */
export interface ITaskCreationPermission {
  canCreateTask: boolean;
  canAddTask: boolean;
  isRestricted: boolean;
}

export interface IProjectTaskCreationContext {
  restrict_task_creation?: boolean;
  is_guest?: boolean;
  role_permissions?: IProjectRolePermissions;
}

export const getTaskCreationPermission = ({
  session,
  project,
  orgConfig,
}: {
  session: ILocalSession | null | undefined;
  project?: IProjectTaskCreationContext | null;
  orgConfig?: { restrict_task_creation?: boolean } | null;
}): ITaskCreationPermission => {
  // Scheme grants are the baseline; the project/org restriction can only narrow them
  const canEditBySchema = !isProjectTaskEditingReadOnly(project);
  const canAddBySchema = canCreateProjectTasks(project);

  const isRestricted =
    canUseFeature(session ?? null, 'restrict_task_creation') &&
    ((project?.restrict_task_creation ?? false) || (orgConfig?.restrict_task_creation ?? false));

  const roleName = getSessionRoleName(session ?? null);
  const isAllowedByRestriction =
    !isRestricted ||
    roleName === ROLE_NAMES.OWNER ||
    roleName === ROLE_NAMES.ADMIN ||
    roleName === ROLE_NAMES.TEAM_LEAD;

  return {
    canCreateTask: canEditBySchema && isAllowedByRestriction,
    canAddTask: canAddBySchema && isAllowedByRestriction,
    // Read-only users see no restriction notice, matching the previous behaviour
    isRestricted: canEditBySchema && isRestricted,
  };
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
