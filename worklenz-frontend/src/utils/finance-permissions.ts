import { ILocalSession } from '@/types/auth/local-session.types';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { getSessionRoleName } from '@/utils/role-permissions.utils';
import { ROLE_NAMES } from '@/types/roles/role.types';

/**
 * Finance view/edit from the project permissions payload when present.
 * Owner/Admin always allowed. Being Project Manager alone does NOT grant finance
 * (Phase 0 D7 / Phase 7) — requires permissions.finance or finance_access.
 */
export const hasFinanceEditPermission = (
  currentSession: ILocalSession | null,
  currentProject?: IProjectViewModel | null
): boolean => {
  if (!currentSession) return false;

  if (currentProject?.permissions) {
    return Boolean(currentProject.permissions.finance);
  }

  if (typeof currentProject?.finance_access === 'boolean') {
    return currentProject.finance_access;
  }

  const currentRole = getSessionRoleName(currentSession);

  return currentRole === ROLE_NAMES.OWNER || currentRole === ROLE_NAMES.ADMIN;
};

export const hasFinanceViewPermission = (
  currentSession: ILocalSession | null,
  currentProject?: IProjectViewModel | null
): boolean => {
  return hasFinanceEditPermission(currentSession, currentProject);
};

export const canEditFixedCost = (
  currentSession: ILocalSession | null,
  currentProject?: IProjectViewModel | null
): boolean => {
  return hasFinanceEditPermission(currentSession, currentProject);
};

export const canEditRateCard = (
  currentSession: ILocalSession | null,
  currentProject?: IProjectViewModel | null
): boolean => {
  return hasFinanceEditPermission(currentSession, currentProject);
};

export const canAddMembersToRateCard = (
  currentSession: ILocalSession | null,
  currentProject?: IProjectViewModel | null
): boolean => {
  return hasFinanceEditPermission(currentSession, currentProject);
};
