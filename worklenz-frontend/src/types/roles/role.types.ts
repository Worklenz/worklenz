import { colors } from '@/styles/colors';

export interface IRole {
  id: string;
  name: string;
  default_role?: boolean;
  admin_role?: boolean;
  owner?: boolean;
  team_id?: string;
}

export interface IRoleOption {
  value: string;
  label: string;
  description?: string;
  labelKey?: string;
  labelDefaultValue?: string;
  descriptionKey?: string;
  descriptionDefaultValue?: string;
}

export const ROLE_NAMES = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  TEAM_LEAD: 'Team Lead',
  MEMBER: 'Member',
} as const;

export type RoleName = (typeof ROLE_NAMES)[keyof typeof ROLE_NAMES];

export interface IRoleDefinition {
  value: RoleName;
  labelKey: string;
  labelDefaultValue: string;
  descriptionKey: string;
  descriptionDefaultValue: string;
  manageableRoles: RoleName[];
  assignableRoles: RoleName[];
  permissionKeys: string[];
  canInviteMembers: boolean;
  canAssignManagers: boolean;
  canAccessFinance: boolean;
  memberScope: 'all' | 'managed' | 'none';
}

export const ROLE_DEFINITIONS: Record<RoleName, IRoleDefinition> = {
  [ROLE_NAMES.OWNER]: {
    value: ROLE_NAMES.OWNER,
    labelKey: 'ownerText',
    labelDefaultValue: 'Team Owner',
    descriptionKey: 'roleDescriptionOwner',
    descriptionDefaultValue: 'Full access to all team settings and billing',
    manageableRoles: [ROLE_NAMES.ADMIN, ROLE_NAMES.TEAM_LEAD, ROLE_NAMES.MEMBER],
    assignableRoles: [ROLE_NAMES.ADMIN, ROLE_NAMES.TEAM_LEAD, ROLE_NAMES.MEMBER],
    permissionKeys: [
      'permissionInviteMembers',
      'permissionManageAllRoles',
      'permissionAssignTeamLeads',
      'permissionAccessFinance',
    ],
    canInviteMembers: true,
    canAssignManagers: true,
    canAccessFinance: true,
    memberScope: 'all',
  },
  [ROLE_NAMES.ADMIN]: {
    value: ROLE_NAMES.ADMIN,
    labelKey: 'adminText',
    labelDefaultValue: 'Admin',
    descriptionKey: 'roleDescriptionAdmin',
    descriptionDefaultValue: 'Can manage admins, team leads, and members across the workspace',
    manageableRoles: [ROLE_NAMES.ADMIN, ROLE_NAMES.TEAM_LEAD, ROLE_NAMES.MEMBER],
    assignableRoles: [ROLE_NAMES.ADMIN, ROLE_NAMES.TEAM_LEAD, ROLE_NAMES.MEMBER],
    permissionKeys: [
      'permissionInviteMembers',
      'permissionManageAdmins',
      'permissionAssignTeamLeads',
      'permissionAccessFinance',
    ],
    canInviteMembers: true,
    canAssignManagers: true,
    canAccessFinance: true,
    memberScope: 'all',
  },
  [ROLE_NAMES.TEAM_LEAD]: {
    value: ROLE_NAMES.TEAM_LEAD,
    labelKey: 'teamLeadText',
    labelDefaultValue: 'Team Lead',
    descriptionKey: 'roleDescriptionTeamLead',
    descriptionDefaultValue: 'Can follow managed-member reporting and team coordination without admin access',
    manageableRoles: [],
    assignableRoles: [],
    permissionKeys: [
      'permissionViewManagedReports',
      'permissionViewAssignedWork',
      'permissionNoMemberManagement',
      'permissionNoFinanceAccess',
    ],
    canInviteMembers: false,
    canAssignManagers: false,
    canAccessFinance: false,
    memberScope: 'managed',
  },
  [ROLE_NAMES.MEMBER]: {
    value: ROLE_NAMES.MEMBER,
    labelKey: 'memberText',
    labelDefaultValue: 'Member',
    descriptionKey: 'roleDescriptionMember',
    descriptionDefaultValue: 'Read-only for team membership management with access to assigned work',
    manageableRoles: [],
    assignableRoles: [],
    permissionKeys: [
      'permissionViewAssignedWork',
      'permissionNoMemberManagement',
      'permissionNoRoleChanges',
      'permissionNoFinanceAccess',
    ],
    canInviteMembers: false,
    canAssignManagers: false,
    canAccessFinance: false,
    memberScope: 'none',
  },
};

export const ROLE_COLORS = {
  [ROLE_NAMES.OWNER]: colors.skyBlue, // Sky blue
  [ROLE_NAMES.ADMIN]: colors.darkYellow, // Darker yellow for better visibility
  [ROLE_NAMES.TEAM_LEAD]: colors.vibrantOrange, // Vibrant orange
  [ROLE_NAMES.MEMBER]: colors.lightGray, // Light gray
} as const;

/**
 * Get role options for role selection dropdown
 */
export function getRoleOptions(includeOwner = false): IRoleOption[] {
  const options: IRoleOption[] = [
    ROLE_DEFINITIONS[ROLE_NAMES.MEMBER],
    ROLE_DEFINITIONS[ROLE_NAMES.TEAM_LEAD],
    ROLE_DEFINITIONS[ROLE_NAMES.ADMIN],
  ].map(role => ({
    value: role.value,
    label: role.labelDefaultValue,
    description: role.descriptionDefaultValue,
    labelKey: role.labelKey,
    labelDefaultValue: role.labelDefaultValue,
    descriptionKey: role.descriptionKey,
    descriptionDefaultValue: role.descriptionDefaultValue,
  }));

  if (includeOwner) {
    options.push({
      value: ROLE_NAMES.OWNER,
      label: ROLE_DEFINITIONS[ROLE_NAMES.OWNER].labelDefaultValue,
      description: ROLE_DEFINITIONS[ROLE_NAMES.OWNER].descriptionDefaultValue,
      labelKey: ROLE_DEFINITIONS[ROLE_NAMES.OWNER].labelKey,
      labelDefaultValue: ROLE_DEFINITIONS[ROLE_NAMES.OWNER].labelDefaultValue,
      descriptionKey: ROLE_DEFINITIONS[ROLE_NAMES.OWNER].descriptionKey,
      descriptionDefaultValue: ROLE_DEFINITIONS[ROLE_NAMES.OWNER].descriptionDefaultValue,
    });
  }

  return options;
}

/**
 * Check if role has admin privileges
 */
export function isAdminRole(roleName: string): boolean {
  return roleName === ROLE_NAMES.OWNER || roleName === ROLE_NAMES.ADMIN;
}

/**
 * Check if role is team lead specifically
 */
export function isTeamLeadRole(roleName: string): boolean {
  return roleName === ROLE_NAMES.TEAM_LEAD;
}

/**
 * Get color for a role - improved visibility for light theme
 */
export function getRoleColor(roleName: string): string {
  switch (roleName?.toLowerCase()) {
    case 'owner':
      return ROLE_COLORS[ROLE_NAMES.OWNER];
    case 'admin':
      return ROLE_COLORS[ROLE_NAMES.ADMIN];
    case 'team lead':
      return ROLE_COLORS[ROLE_NAMES.TEAM_LEAD];
    case 'member':
      return ROLE_COLORS[ROLE_NAMES.MEMBER];
    default:
      return colors.darkGray; // Dark gray fallback
  }
}
