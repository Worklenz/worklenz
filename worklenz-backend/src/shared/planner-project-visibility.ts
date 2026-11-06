import db from "../config/db";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";

/**
 * Projects a guest may see on Planner routes that otherwise return the whole team.
 * Membership is the guest's project visibility; callers skip this when View all projects applies.
 */
export async function listGuestVisibleProjectIds(userId: string, teamId: string): Promise<string[]> {
  const result = await db.query(
    `SELECT p.id
     FROM projects p
     WHERE p.team_id = $1
       AND EXISTS (
         SELECT 1
         FROM project_members pm
         JOIN team_members tm ON tm.id = pm.team_member_id
         WHERE pm.project_id = p.id
           AND tm.user_id = $2
           AND tm.team_id = $1
           AND tm.active = TRUE
       )`,
    [teamId, userId]
  );
  return result.rows.map((row: { id: string }) => row.id);
}

/** Keeps every project when the request is not limited to a guest's memberships. */
export function limitPlannerProjects<T>(
  req: IWorkLenzRequest,
  projects: T[] | null | undefined,
  projectId: (project: T) => string | null | undefined
): T[] {
  const visible = req.plannerVisibleProjectIds;
  if (!visible) return projects ?? [];
  const allowed = new Set(visible);
  return (projects ?? []).filter(project => {
    const id = projectId(project);
    return typeof id === "string" && allowed.has(id);
  });
}

/** Reads either `id` or `project_id` from a planner project payload. */
export function plannerProjectId(
  project: { id?: string; project_id?: string } | null | undefined
): string | null {
  return project?.id || project?.project_id || null;
}
