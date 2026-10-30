import db from "../config/db";

/**
 * Teams the user may use as reporting/analytics scopes:
 * - Owner/Admin of the session team: all teams owned by the same owner
 * - Team Lead / member: session team plus other org teams where they have project membership
 */
export async function getAccessibleReportingTeamIds(
  userId: string,
  sessionTeamId: string
): Promise<string[]> {
  const result = await db.query(
    `
    WITH session_team AS (
      SELECT id, user_id AS owner_id
      FROM teams
      WHERE id = $1::UUID
    ),
    org_teams AS (
      SELECT t.id
      FROM teams t
      JOIN session_team st ON st.owner_id = t.user_id
    ),
    is_session_elevated AS (
      SELECT EXISTS (
        SELECT 1
        FROM team_members tm
        JOIN roles r ON r.id = tm.role_id
        WHERE tm.user_id = $2::UUID
          AND tm.team_id = $1::UUID
          AND tm.active = TRUE
          AND (r.owner = TRUE OR r.admin_role = TRUE)
      ) AS elevated
    )
    SELECT ot.id
    FROM org_teams ot
    CROSS JOIN is_session_elevated e
    WHERE e.elevated
       OR ot.id = $1::UUID
       OR EXISTS (
            SELECT 1
            FROM project_members pm
            JOIN team_members tm ON tm.id = pm.team_member_id
            JOIN projects p ON p.id = pm.project_id
            WHERE p.team_id = ot.id
              AND tm.user_id = $2::UUID
              AND tm.team_id = ot.id
              AND tm.active = TRUE
          )
    `,
    [sessionTeamId, userId]
  );

  const ids = result.rows.map((row: { id: string }) => row.id);
  return ids.length > 0 ? ids : [sessionTeamId];
}

/**
 * Expand session-team project access to cover other selected reporting teams.
 *
 * Matches overview project listing: owner/admins of the active team can see
 * projects on every team owned by that team's owner (organization scope),
 * not only teams where they are a direct member.
 */
export async function expandAccessibleProjects(
  userId: string,
  sessionTeamId: string,
  baseProjectIds: string[],
  requestedTeamIds: string[]
): Promise<string[]> {
  const accessibleTeams = new Set(
    await getAccessibleReportingTeamIds(userId, sessionTeamId)
  );
  const validatedRequested = requestedTeamIds.filter(
    id => !!id && accessibleTeams.has(id)
  );
  const teamIds = [...new Set([sessionTeamId, ...validatedRequested])];
  if (teamIds.length <= 1) return baseProjectIds;

  const result = await db.query(
    `SELECT DISTINCT p.id
     FROM projects p
     WHERE p.team_id = ANY($1::UUID[])
       AND (
         -- Org scope: session owner/admin can see all teams owned by the same owner
         (
           EXISTS (
             SELECT 1
             FROM team_members tm
             JOIN roles r ON r.id = tm.role_id
             WHERE tm.user_id = $2::UUID
               AND tm.team_id = $3::UUID
               AND tm.active = TRUE
               AND (r.owner = TRUE OR r.admin_role = TRUE)
           )
           AND EXISTS (
             SELECT 1
             FROM teams t_proj
             JOIN teams t_session ON t_session.user_id = t_proj.user_id
             WHERE t_proj.id = p.team_id
               AND t_session.id = $3::UUID
           )
         )
         OR EXISTS (
           SELECT 1 FROM team_members tm
           JOIN roles r ON r.id = tm.role_id
           WHERE tm.user_id = $2::UUID
             AND tm.team_id = p.team_id
             AND tm.active = TRUE
             AND (r.owner = TRUE OR r.admin_role = TRUE)
         )
         OR EXISTS (
           SELECT 1 FROM project_members pm
           JOIN team_members tm ON tm.id = pm.team_member_id
           WHERE pm.project_id = p.id
             AND tm.user_id = $2::UUID
             AND tm.team_id = p.team_id
             AND tm.active = TRUE
         )
       )`,
    [teamIds, userId, sessionTeamId]
  );

  return result.rows.map((row: { id: string }) => row.id);
}

export function parseTeamIdsFromInput(input: Record<string, unknown>): string[] {
  const raw = input.team_ids;
  if (Array.isArray(raw)) {
    return raw.filter((v): v is string => typeof v === "string" && !!v);
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw
      .split(/[,\s]+/)
      .map(s => s.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Parse team_ids from request input and keep only teams the user may access.
 */
export async function parseAccessibleTeamIdsFromInput(
  userId: string,
  sessionTeamId: string,
  input: Record<string, unknown>
): Promise<string[]> {
  const requested = parseTeamIdsFromInput(input);
  const accessible = new Set(
    await getAccessibleReportingTeamIds(userId, sessionTeamId)
  );
  if (requested.length === 0) return [];
  return requested.filter(id => accessible.has(id));
}
