import { useMemo } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAuthService } from '@/hooks/useAuth';
import useIsProjectManager from '@/hooks/useIsProjectManager';
import { ILocalSession } from '@/types/auth/local-session.types';
import { canUseFeature } from '@/utils/subscription-utils';
import { IProjectRolePermissions } from '@/types/project/projectViewModel.types';
import {
  canCreateProjectTasks,
  isProjectTaskEditingReadOnly,
} from '@/lib/project/project-view-guest';

/**
 * Returns whether the current user can modify and add tasks in the current project.
 *
 * Rules (permission scheme is the source of truth):
 *  - Modifying/assigning tasks needs "Edit tasks".
 *  - Adding new tasks (and subtasks, duplicates, copies) needs "Create tasks".
 *  - Grants apply on invited projects and on View-all non-invited projects.
 *
 * The legacy Business Plan `restrict_task_creation` toggle no longer overrides
 * scheme grants — revoke Create/Edit tasks in Roles & Permissions instead.
 */
export interface ITaskCreationPermission {
  canCreateTask: boolean;
  canAddTask: boolean;
  isRestricted: boolean;
}

export interface IProjectTaskCreationContext {
  restrict_task_creation?: boolean;
  is_guest?: boolean;
  is_project_manager?: boolean;
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
  isProjectManager?: boolean;
}): ITaskCreationPermission => {
  const canEditBySchema = !isProjectTaskEditingReadOnly(project);
  const canAddBySchema = canCreateProjectTasks(project);

  const restrictToggleOn =
    canUseFeature(session ?? null, 'restrict_task_creation') &&
    ((project?.restrict_task_creation ?? false) || (orgConfig?.restrict_task_creation ?? false));

  return {
    canCreateTask: canEditBySchema,
    canAddTask: canAddBySchema,
    isRestricted: canEditBySchema && restrictToggleOn,
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
  const isProjectManager = useIsProjectManager();

  return useMemo<ITaskCreationPermission>(() => {
    const project = projectOverride !== undefined ? projectOverride : reduxProject;
    return getTaskCreationPermission({
      session,
      project,
      orgConfig,
      isProjectManager,
    });
  }, [session, reduxProject, orgConfig, projectOverride, isProjectManager]);
};

export default useTaskCreationPermission;
