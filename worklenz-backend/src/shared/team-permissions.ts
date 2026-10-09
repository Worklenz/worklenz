import db from "../config/db";
import { IPassportSession } from "../interfaces/passport-session";

export const TEAM_ROLE_NAMES = {
  OWNER: "Owner",
  ADMIN: "Admin",
  TEAM_LEAD: "Team Lead",
  MEMBER: "Member",
} as const;

export type TeamRoleName =
  (typeof TEAM_ROLE_NAMES)[keyof typeof TEAM_ROLE_NAMES];

const MANAGEABLE_ROLE_MAP: Record<TeamRoleName, TeamRoleName[]> = {
  [TEAM_ROLE_NAMES.OWNER]: [
    TEAM_ROLE_NAMES.ADMIN,
    TEAM_ROLE_NAMES.TEAM_LEAD,
    TEAM_ROLE_NAMES.MEMBER,
  ],
  [TEAM_ROLE_NAMES.ADMIN]: [
    TEAM_ROLE_NAMES.ADMIN,
    TEAM_ROLE_NAMES.TEAM_LEAD,
    TEAM_ROLE_NAMES.MEMBER,
  ],
  [TEAM_ROLE_NAMES.TEAM_LEAD]: [],
  [TEAM_ROLE_NAMES.MEMBER]: [],
};

export function normalizeTeamRoleName(roleName?: string | null): TeamRoleName {
  const normalizedRoleName = roleName?.toLowerCase().trim();

  if (normalizedRoleName === "owner") {
    return TEAM_ROLE_NAMES.OWNER;
  }

  if (normalizedRoleName === "admin") {
    return TEAM_ROLE_NAMES.ADMIN;
  }

  if (normalizedRoleName === "team lead" || normalizedRoleName === "teamlead") {
    return TEAM_ROLE_NAMES.TEAM_LEAD;
  }

  return TEAM_ROLE_NAMES.MEMBER;
}

export function getEffectiveTeamRole(
  user: IPassportSession | undefined,
): TeamRoleName {
  if (user?.owner) {
    return TEAM_ROLE_NAMES.OWNER;
  }

  if (user?.role_name) {
    return normalizeTeamRoleName(user.role_name);
  }

  if (user?.is_admin) {
    return TEAM_ROLE_NAMES.ADMIN;
  }

  return TEAM_ROLE_NAMES.MEMBER;
}

export function canManageTargetRole(
  currentUser: IPassportSession | undefined,
  targetRoleName?: string | null,
): boolean {
  const actorRole = getEffectiveTeamRole(currentUser);
  const targetRole = normalizeTeamRoleName(targetRoleName);
  return MANAGEABLE_ROLE_MAP[actorRole].includes(targetRole);
}

export function canAssignRole(
  currentUser: IPassportSession | undefined,
  targetRoleName?: string | null,
): boolean {
  return canManageTargetRole(currentUser, targetRoleName);
}

export function canAssignManagerRelationship(
  currentUser: IPassportSession | undefined,
  memberRoleName?: string | null,
  managerRoleName?: string | null,
): boolean {
  if (!canManageTeamMembers(currentUser)) {
    return false;
  }

  return (
    normalizeTeamRoleName(memberRoleName) === TEAM_ROLE_NAMES.MEMBER &&
    normalizeTeamRoleName(managerRoleName) === TEAM_ROLE_NAMES.TEAM_LEAD
  );
}

export async function getTeamMemberRoleName(
  teamMemberId: string,
  teamId: string,
): Promise<TeamRoleName | null> {
  if (!teamMemberId || !teamId) {
    return null;
  }

  const q = `
    SELECT r.name
    FROM team_members tm
    JOIN roles r ON tm.role_id = r.id
    WHERE tm.id = $1::UUID
      AND tm.team_id = $2::UUID;
  `;

  const result = await db.query(q, [teamMemberId, teamId]);
  const roleName = result.rows[0]?.name;

  return roleName ? normalizeTeamRoleName(roleName) : null;
}

/**
 * Utility functions for team permission checks
 */

/**
 * Check if user is team owner
 */
export function isTeamOwner(user: IPassportSession | undefined): boolean {
  return !!user?.owner;
}

/**
 * Check if user is team admin (Admin role only; Team Leads are scoped separately)
 */
export function isTeamAdmin(user: IPassportSession | undefined): boolean {
  return getEffectiveTeamRole(user) === TEAM_ROLE_NAMES.ADMIN;
}

/**
 * Check if user is team lead specifically (from session)
 * Uses getEffectiveTeamRole so casing / owner flags stay consistent with TVR-17.
 */
export function isTeamLeadFromSession(user: IPassportSession | undefined): boolean {
  return getEffectiveTeamRole(user) === TEAM_ROLE_NAMES.TEAM_LEAD;
}

/**
 * Check if user is team lead specifically (database query)
 */
export async function isTeamLead(userId: string, teamId: string): Promise<boolean> {
  if (!userId || !teamId) return false;
  
  const q = `
    SELECT EXISTS(
      SELECT 1 
      FROM team_members tm
      JOIN roles r ON tm.role_id = r.id
      WHERE tm.user_id = $1::UUID
        AND tm.team_id = $2::UUID
        AND r.name = 'Team Lead'
        AND r.admin_role = TRUE
    ) AS is_team_lead;
  `;
  
  const result = await db.query(q, [userId, teamId]);
  return result.rows[0]?.is_team_lead || false;
}

/**
 * Check if user has admin privileges in team (Owner or Admin)
 */
export function hasTeamAdminPrivileges(user: IPassportSession | undefined): boolean {
  const currentRole = getEffectiveTeamRole(user);
  return currentRole === TEAM_ROLE_NAMES.OWNER || currentRole === TEAM_ROLE_NAMES.ADMIN;
}

/**
 * Check if user can manage team members (Owner or Admin)
 */
export function canManageTeamMembers(user: IPassportSession | undefined): boolean {
  return hasTeamAdminPrivileges(user);
}

/**
 * Check if user can manage projects within team (Owner or Admin)
 */
export function canManageTeamProjects(user: IPassportSession | undefined): boolean {
  return hasTeamAdminPrivileges(user);
}

/**
 * Get user's role name within a team
 */
export async function getManagedMembers(teamMemberId: string): Promise<string[]> {
  if (!teamMemberId) return [];

  const q = `
    SELECT managed_member_id 
    FROM team_lead_managed_members 
    WHERE manager_id = $1::UUID;
  `;

  const result = await db.query(q, [teamMemberId]);
  return result.rows.map(row => row.managed_member_id);
}

/**
 * Team-wide guest check for the user's active team, exempting owner/admin
 * roles the same way NON_GUEST_ACCESS_PREDICATE does (sync_team_member_guest_status()
 * sets is_guest = TRUE for anyone holding a GUEST-level membership on any single
 * project, with no role exception, so an owner/admin added as a guest to one
 * client's project must not be locked out team-wide). Shared by
 * verify-non-guest-planner-access.ts and verify-non-guest-time-entries-access.ts
 * so the two route families can't drift on what "guest" means.
 */
export async function isGuestForActiveTeam(userId: string | undefined, teamId: string | undefined): Promise<boolean> {
  if (!userId || !teamId) return false;

  const result = await db.query(
    `SELECT tm.is_guest, r.owner, r.admin_role
     FROM team_members tm
     INNER JOIN roles r ON r.id = tm.role_id
     WHERE tm.user_id = $1
       AND tm.team_id = $2
       AND tm.active = TRUE
     LIMIT 1`,
    [userId, teamId]
  );

  const row = result.rows[0];
  return row?.is_guest === true && row?.owner !== true && row?.admin_role !== true;
}

export async function getUserRoleInTeam(userId: string, teamId: string): Promise<string | null> {
  if (!userId || !teamId) return null;
  
  const q = `
    SELECT r.name 
    FROM team_members tm
    JOIN roles r ON tm.role_id = r.id
    WHERE tm.user_id = $1::UUID
      AND tm.team_id = $2::UUID;
  `;
  
  const result = await db.query(q, [userId, teamId]);
  return result.rows[0]?.name || null;
}
