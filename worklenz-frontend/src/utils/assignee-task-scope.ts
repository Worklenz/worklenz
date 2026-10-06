import { getSessionRoleName } from '@/utils/role-permissions.utils';
import { ROLE_NAMES, RoleName } from '@/types/roles/role.types';

export interface AssigneeScopeActiveInput {
  restrictTasksToAssignee?: boolean;
  isProjectGuest?: boolean;
  isSessionGuest?: boolean;
  isOwnerOrAdmin?: boolean;
  roleName?: RoleName | string | null;
  isProjectManager?: boolean;
}

/**
 * Pure TVR-16/17 indicator logic — true when the user is a restricted member
 * under `restrict_tasks_to_assignee`.
 */
export const getIsAssigneeTaskScopeActive = (
  input: AssigneeScopeActiveInput
): boolean => {
  if (!input.restrictTasksToAssignee) {
    return false;
  }

  if (input.isProjectGuest === true || input.isSessionGuest === true) {
    return false;
  }

  if (input.isOwnerOrAdmin) {
    return false;
  }

  const roleName =
    typeof input.roleName === 'string'
      ? getSessionRoleName({ role_name: input.roleName } as any)
      : input.roleName;

  if (roleName === ROLE_NAMES.TEAM_LEAD) {
    return false;
  }

  if (input.isProjectManager) {
    return false;
  }

  return true;
};
