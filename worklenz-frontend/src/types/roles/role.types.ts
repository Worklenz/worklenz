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
}

export const ROLE_NAMES = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  TEAM_LEAD: 'Team Lead',
  MEMBER: 'Member',
} as const;

export type RoleName = (typeof ROLE_NAMES)[keyof typeof ROLE_NAMES];

export const ROLE_DESCRIPTIONS = {
  [ROLE_NAMES.OWNER]: 'Full access to all team settings and billing',
  [ROLE_NAMES.ADMIN]: 'Full admin access to team management and settings',
  [ROLE_NAMES.TEAM_LEAD]: 'Admin access limited to this team only',
  [ROLE_NAMES.MEMBER]: 'Standard team member with basic access',
} as const;

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
    {
      value: ROLE_NAMES.MEMBER,
      label: ROLE_NAMES.MEMBER,
      description: ROLE_DESCRIPTIONS[ROLE_NAMES.MEMBER],
    },
    {
      value: ROLE_NAMES.TEAM_LEAD,
      label: ROLE_NAMES.TEAM_LEAD,
      description: ROLE_DESCRIPTIONS[ROLE_NAMES.TEAM_LEAD],
    },
    {
      value: ROLE_NAMES.ADMIN,
      label: ROLE_NAMES.ADMIN,
      description: ROLE_DESCRIPTIONS[ROLE_NAMES.ADMIN],
    },
  ];

  if (includeOwner) {
    options.push({
      value: ROLE_NAMES.OWNER,
      label: ROLE_NAMES.OWNER,
      description: ROLE_DESCRIPTIONS[ROLE_NAMES.OWNER],
    });
  }

  return options;
}

/**
 * Check if role has admin privileges
 */
export function isAdminRole(roleName: string): boolean {
  return [ROLE_NAMES.OWNER, ROLE_NAMES.ADMIN, ROLE_NAMES.TEAM_LEAD].includes(roleName as RoleName);
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
