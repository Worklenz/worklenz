import db from "../config/db";
import { IPassportSession } from "../interfaces/passport-session";

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
 * Check if user is team admin (includes both Admin and Team Lead roles)
 */
export function isTeamAdmin(user: IPassportSession | undefined): boolean {
  return !!user?.is_admin;
}

/**
 * Check if user is team lead specifically
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
 * Check if user has admin privileges in team (Owner, Admin, or Team Lead)
 */
export function hasTeamAdminPrivileges(user: IPassportSession | undefined): boolean {
  return isTeamOwner(user) || isTeamAdmin(user);
}

/**
 * Check if user can manage team members (Owner, Admin, or Team Lead)
 */
export function canManageTeamMembers(user: IPassportSession | undefined): boolean {
  return hasTeamAdminPrivileges(user);
}

/**
 * Check if user can manage projects within team (Owner, Admin, or Team Lead)
 */
export function canManageTeamProjects(user: IPassportSession | undefined): boolean {
  return hasTeamAdminPrivileges(user);
}

/**
 * Get user's role name within a team
 */
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