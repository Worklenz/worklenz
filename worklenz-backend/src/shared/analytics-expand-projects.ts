import db from "../config/db";

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
  const teamIds = [...new Set([sessionTeamId, ...requestedTeamIds.filter(Boolean)])];
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
