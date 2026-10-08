/**
 * Who may edit/delete a task time log:
 * - the log owner
 * - team Owner/Admin
 * - Project Manager on the log's project (Phase 0: full task actions on that project)
 */

import db from "../config/db";
import { IPassportSession } from "../interfaces/passport-session";
import { getProjectAccess } from "./project-access";
import { hasTeamAdminPrivileges } from "./team-permissions";
import { log_error } from "./utils";

export interface TaskWorkLogManageContext {
  id: string;
  task_id: string;
  user_id: string;
  project_id: string;
  team_id: string | null;
  canManage: boolean;
}

export const resolveTaskWorkLogManageAccess = async (
  workLogId: string,
  user: IPassportSession | undefined
): Promise<TaskWorkLogManageContext | null> => {
  if (!workLogId || !user?.id) return null;

  try {
    const result = await db.query(
      `
        SELECT
          twl.id,
          twl.task_id,
          twl.user_id,
          t.project_id,
          p.team_id
        FROM task_work_log twl
        INNER JOIN tasks t ON t.id = twl.task_id
        INNER JOIN projects p ON p.id = t.project_id
        WHERE twl.id = $1::UUID
        LIMIT 1;
      `,
      [workLogId]
    );

    const row = result.rows[0];
    if (!row) return null;

    if (user.team_id && row.team_id && user.team_id !== row.team_id) {
      return {
        id: row.id,
        task_id: row.task_id,
        user_id: row.user_id,
        project_id: row.project_id,
        team_id: row.team_id,
        canManage: false,
      };
    }

    if (row.user_id === user.id || hasTeamAdminPrivileges(user)) {
      return {
        id: row.id,
        task_id: row.task_id,
        user_id: row.user_id,
        project_id: row.project_id,
        team_id: row.team_id,
        canManage: true,
      };
    }

    const access = await getProjectAccess(user, row.project_id);
    return {
      id: row.id,
      task_id: row.task_id,
      user_id: row.user_id,
      project_id: row.project_id,
      team_id: row.team_id,
      canManage: Boolean(access.isProjectManager),
    };
  } catch (error) {
    log_error(error);
    return null;
  }
};
