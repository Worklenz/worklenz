/**
 * Phase 6 — PM lifecycle helpers: clear PM rows, emit permission-changed,
 * and support audit callers.
 */

import db from "../config/db";
import { IO } from "./io";
import { SocketEvents } from "../socket.io/events";
import { log_error } from "./utils";

export type ProjectPermissionChangeReason =
  | "pm_removed"
  | "pm_assigned"
  | "finance_access_changed"
  | "member_deactivated"
  | "member_removed"
  | "project_team_changed";

export interface ProjectPermissionChangedPayload {
  project_id: string;
  reason: ProjectPermissionChangeReason;
  /** User ids that should treat this as a personal permission loss. */
  affected_user_ids?: string[];
}

export interface ClearedPmRow {
  project_id: string;
  team_member_id: string;
  user_id: string | null;
  socket_id: string | null;
  project_name: string | null;
  team_id: string | null;
}

const PM_SELECT = `
  SELECT
    pm.project_id,
    pm.team_member_id,
    tm.user_id,
    u.socket_id,
    p.name AS project_name,
    p.team_id
  FROM project_members pm
  INNER JOIN team_members tm ON tm.id = pm.team_member_id
  LEFT JOIN users u ON u.id = tm.user_id
  INNER JOIN projects p ON p.id = pm.project_id
`;

/**
 * Demote all PROJECT_MANAGER rows for a team member to MEMBER.
 * Used on deactivate so they lose PM elevation without removing membership.
 */
export const clearPmAccessForTeamMember = async (
  teamMemberId: string
): Promise<ClearedPmRow[]> => {
  if (!teamMemberId) return [];

  try {
    const existing = await db.query(
      `${PM_SELECT}
       WHERE pm.team_member_id = $1::UUID
         AND pm.project_access_level_id = (
           SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER'
         );`,
      [teamMemberId]
    );
    const rows = existing.rows as ClearedPmRow[];
    if (!rows.length) return [];

    await db.query(
      `
        UPDATE project_members
        SET project_access_level_id = (
              SELECT id FROM project_access_levels WHERE key = 'MEMBER'
            ),
            finance_access = FALSE
        WHERE team_member_id = $1::UUID
          AND project_access_level_id = (
            SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER'
          );
      `,
      [teamMemberId]
    );

    return rows;
  } catch (error) {
    log_error(error);
    return [];
  }
};

/** List current PM rows for a team member (before delete cascade). */
export const listPmProjectsForTeamMember = async (
  teamMemberId: string
): Promise<ClearedPmRow[]> => {
  if (!teamMemberId) return [];

  try {
    const result = await db.query(
      `${PM_SELECT}
       WHERE pm.team_member_id = $1::UUID
         AND pm.project_access_level_id = (
           SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER'
         );`,
      [teamMemberId]
    );
    return result.rows as ClearedPmRow[];
  } catch (error) {
    log_error(error);
    return [];
  }
};

/**
 * Clear all PROJECT_MANAGER rows on a project (e.g. project team changed).
 * Demotes to MEMBER.
 */
export const clearAllPmAccessForProject = async (
  projectId: string
): Promise<ClearedPmRow[]> => {
  if (!projectId) return [];

  try {
    const existing = await db.query(
      `${PM_SELECT}
       WHERE pm.project_id = $1::UUID
         AND pm.project_access_level_id = (
           SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER'
         );`,
      [projectId]
    );
    const rows = existing.rows as ClearedPmRow[];
    if (!rows.length) return [];

    await db.query(
      `
        UPDATE project_members
        SET project_access_level_id = (
              SELECT id FROM project_access_levels WHERE key = 'MEMBER'
            ),
            finance_access = FALSE
        WHERE project_id = $1::UUID
          AND project_access_level_id = (
            SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER'
          );
      `,
      [projectId]
    );

    return rows;
  } catch (error) {
    log_error(error);
    return [];
  }
};

/**
 * Emit PROJECT_PERMISSION_CHANGED to the project room and affected users.
 */
export const emitProjectPermissionChanged = (
  payload: ProjectPermissionChangedPayload
): void => {
  try {
    const event = SocketEvents.PROJECT_PERMISSION_CHANGED.toString();
    const io = IO.getInstance();

    if (io && payload.project_id) {
      io.to(payload.project_id).emit(event, payload);
    }

    for (const userId of payload.affected_user_ids || []) {
      void IO.emitByUserId(userId, null, SocketEvents.PROJECT_PERMISSION_CHANGED, payload);
    }
  } catch (error) {
    log_error(error);
  }
};

export const notifyClearedPmRows = (
  rows: ClearedPmRow[],
  reason: ProjectPermissionChangeReason
): void => {
  const byProject = new Map<string, ClearedPmRow[]>();
  for (const row of rows) {
    const list = byProject.get(row.project_id) || [];
    list.push(row);
    byProject.set(row.project_id, list);
  }

  for (const [projectId, projectRows] of byProject) {
    emitProjectPermissionChanged({
      project_id: projectId,
      reason,
      affected_user_ids: projectRows
        .map(r => r.user_id)
        .filter((id): id is string => Boolean(id)),
    });
  }
};
