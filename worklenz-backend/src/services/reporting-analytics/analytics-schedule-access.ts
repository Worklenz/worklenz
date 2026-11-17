import db from "../../config/db";
import { IPassportSession } from "../../interfaces/passport-session";
import {
  expandAccessibleProjects,
  parseAccessibleTeamIdsFromInput,
} from "../../shared/analytics-expand-projects";
import { canViewAllProjects } from "../../shared/organization-permissions";
import { getVisibleProjectIds } from "../../shared/project-role-permissions";
import {
  getEffectiveTeamRole,
  TEAM_ROLE_NAMES,
} from "../../shared/team-permissions";

async function loadScheduleOwnerSession(
  userId: string,
  teamId: string
): Promise<IPassportSession | null> {
  const result = await db.query(
    `SELECT
       tm.id AS team_member_id,
       r.name AS role_name,
       COALESCE(r.owner, FALSE) AS is_owner,
       COALESCE(r.admin_role, FALSE) AS is_admin_role
     FROM team_members tm
     JOIN roles r ON r.id = tm.role_id
     WHERE tm.user_id = $1::UUID
       AND tm.team_id = $2::UUID
       AND tm.active = TRUE
     ORDER BY r.owner DESC, r.admin_role DESC
     LIMIT 1`,
    [userId, teamId]
  );
  const row = result.rows[0];
  if (!row) return null;

  return {
    id: userId,
    team_id: teamId,
    team_member_id: row.team_member_id,
    role_name: row.role_name,
    owner: !!row.is_owner,
    is_admin: !!row.is_admin_role && String(row.role_name).toLowerCase() === "admin",
  };
}

/**
 * Resolve project IDs the schedule owner may include when the cron regenerates
 * a live export (mirrors analytics-project-access middleware without a request).
 */
export async function resolveScheduleOwnerAccessibleProjectIds(
  userId: string,
  teamId: string,
  filters: Record<string, unknown>
): Promise<string[]> {
  const session = await loadScheduleOwnerSession(userId, teamId);
  if (!session) return [];

  const role = getEffectiveTeamRole(session);
  const seesAllTeamProjects =
    role === TEAM_ROLE_NAMES.OWNER ||
    role === TEAM_ROLE_NAMES.ADMIN ||
    role === TEAM_ROLE_NAMES.TEAM_LEAD ||
    (await canViewAllProjects(session));

  const projectQuery = seesAllTeamProjects
    ? `SELECT p.id FROM projects p WHERE p.team_id = $1::UUID`
    : `SELECT p.id
       FROM projects p
       WHERE p.team_id = $1::UUID
         AND EXISTS (
           SELECT 1 FROM project_members pm
           JOIN team_members tm ON tm.id = pm.team_member_id
           WHERE pm.project_id = p.id
             AND tm.user_id = $2::UUID
             AND tm.team_id = $1::UUID
             AND tm.active = TRUE
         )`;

  const projectResult = await db.query(
    projectQuery,
    seesAllTeamProjects ? [teamId] : [teamId, userId]
  );
  const sessionAccessible = projectResult.rows.map((row: { id: string }) => row.id);

  const requestedTeamIds = await parseAccessibleTeamIdsFromInput(userId, teamId, filters);
  const accessibleList = await expandAccessibleProjects(
    userId,
    teamId,
    sessionAccessible,
    requestedTeamIds
  );

  const visibilityByTeam = await Promise.all(
    [...new Set([teamId, ...requestedTeamIds])].map(id => getVisibleProjectIds(userId, id))
  );
  const visible = new Set(visibilityByTeam.flat());
  if (role === TEAM_ROLE_NAMES.OWNER || role === TEAM_ROLE_NAMES.ADMIN) {
    accessibleList.forEach(id => visible.add(id));
  }

  const accessible = accessibleList.filter(id => visible.has(id));

  const requestedRaw = filters.project_ids;
  const requested = Array.isArray(requestedRaw)
    ? requestedRaw.filter((v): v is string => typeof v === "string" && !!v)
    : typeof requestedRaw === "string" && requestedRaw.trim()
      ? requestedRaw
          .split(/[,\s]+/)
          .map(s => s.trim())
          .filter(Boolean)
      : [];

  if (requested.length === 0) return accessible;

  const allowed = new Set(accessible);
  const intersected = requested.filter(id => allowed.has(id));
  return intersected.length > 0 ? intersected : accessible;
}
