import { ILocalSession } from '@/types/auth/local-session.types';
import { IRoleOption, ROLE_DEFINITIONS, ROLE_NAMES, RoleName } from '@/types/roles/role.types';

export const normalizeRoleName = (roleName?: string, isOwner?: boolean): RoleName => {
  if (isOwner) {
    return ROLE_NAMES.OWNER;
  }

  const normalizedRoleName = roleName?.toLowerCase().trim();

  if (normalizedRoleName === 'owner') {
    return ROLE_NAMES.OWNER;
  }

  if (normalizedRoleName === 'admin') {
    return ROLE_NAMES.ADMIN;
  }

  if (normalizedRoleName === 'team lead' || normalizedRoleName === 'teamlead') {
    return ROLE_NAMES.TEAM_LEAD;
  }

  return ROLE_NAMES.MEMBER;
};

export const getSessionRoleName = (session: ILocalSession | null): RoleName => {
  return normalizeRoleName(session?.role_name, session?.owner);
};

/**
 * Check if current user can edit/manage another user's role
 */
export function canManageUserRole(
  currentUserRole: string | undefined,
  targetUserRole: string | undefined,
  isOwner?: boolean
): boolean {
  const actorRole = normalizeRoleName(currentUserRole, isOwner);
  const targetRole = normalizeRoleName(targetUserRole);
  return ROLE_DEFINITIONS[actorRole].manageableRoles.includes(targetRole);
}

/**
 * Get available role options for role assignment based on current user permissions
 */
export function getAvailableRoleOptions(
  currentUserRole: string | undefined,
  isOwner?: boolean
): IRoleOption[] {
  const actorRole = normalizeRoleName(currentUserRole, isOwner);
  return ROLE_DEFINITIONS[actorRole].assignableRoles.map(roleName => {
    const roleDefinition = ROLE_DEFINITIONS[roleName];

    return {
      value: roleDefinition.value,
      label: roleDefinition.labelDefaultValue,
      description: roleDefinition.descriptionDefaultValue,
      labelKey: roleDefinition.labelKey,
      labelDefaultValue: roleDefinition.labelDefaultValue,
      descriptionKey: roleDefinition.descriptionKey,
      descriptionDefaultValue: roleDefinition.descriptionDefaultValue,
    };
  });
}
