import { useAuthService } from '@/hooks/useAuth';
import useIsProjectManager from '@/hooks/useIsProjectManager';
import { useAppSelector } from '@/hooks/useAppSelector';
import { getSessionRoleName } from '@/utils/role-permissions.utils';
import { getIsAssigneeTaskScopeActive } from '@/utils/assignee-task-scope';

/**
 * TVR-16 / TVR-17: true when the current user is subject to
 * `projects.restrict_tasks_to_assignee` (sees only their assigned tasks).
 *
 * Exempt (always bypass — mirrors backend `isAssigneeScopeSessionExempt`
 * + Project Manager DB check):
 * Owner, Admin, Team Lead (workspace), Guest, Project Manager (per-project).
 */
const useIsAssigneeTaskScopeActive = (): boolean => {
  const authService = useAuthService();
  const session = authService.getCurrentSession();
  const project = useAppSelector(state => state.projectReducer.project);
  const isProjectManager = useIsProjectManager();

  return getIsAssigneeTaskScopeActive({
    restrictTasksToAssignee: !!project?.restrict_tasks_to_assignee,
    isProjectGuest: project?.is_guest === true,
    isSessionGuest: session?.is_guest === true,
    isOwnerOrAdmin: authService.isOwnerOrAdmin(),
    roleName: getSessionRoleName(session),
    isProjectManager,
  });
};

export default useIsAssigneeTaskScopeActive;
