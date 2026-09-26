import { Server, Socket } from "socket.io";
import db from "../config/db";
import { IPassportSession } from "../interfaces/passport-session";
import {
  hasTeamAdminPrivileges,
  isTeamLeadFromSession,
} from "./team-permissions";
import { teamMemberIsGuestPredicate } from "./guest-access-sql";

/**
 * Assignee-scope enforcement for `projects.restrict_tasks_to_assignee`.
 *
 * When the setting is ON, restricted members only see:
 * - tasks they are assigned to, and
 * - parent tasks of subtasks they are assigned to (context / read-only later).
 *
 * TVR-17 / TVR-1 role mapping (always bypass, regardless of setting):
 * - Owner (workspace / team owner)
 * - Admin (workspace role)
 * - Team Lead (workspace role — not Project Manager)
 * - Guest (team_members.is_guest or project access level GUEST)
 * - Project Manager (per-project access level PROJECT_MANAGER)
 *
 * TVR-18 / TVR-1 surface scope (this pass):
 * IN SCOPE — List, Board, Roadmap/Gantt, Calendar, in-project search/quick-find,
 *            task deep-link / socket task payloads (with notification/mention exception).
 * EXPLICITLY OUT OF SCOPE — workspace Reports, Team Lead Reports, project Workload,
 *            project Insights/Overview dashboards, and other reporting aggregates.
 *            Do not wire `resolveAssigneeTaskScope` / multi-project clauses into those
 *            controllers without a new product decision. Task-detail access checks
 *            (TVR-11) still apply if a restricted member opens a specific task from
 *            an excluded surface.
 */

/** Documented surfaces that intentionally do NOT apply assignee-scope filtering (TVR-18). */
export const ASSIGNEE_SCOPE_EXCLUDED_SURFACES = [
  "reports",
  "team-lead-reports",
  "workload",
  "project-insights",
  "project-overview-dashboard",
] as const;

export type AssigneeScopeExcludedSurface =
  (typeof ASSIGNEE_SCOPE_EXCLUDED_SURFACES)[number];

export interface AssigneeTaskScope {
  /** When true, SQL must filter to the requester's visible tasks */
  applyFilter: boolean;
  teamMemberId: string | null;
}

export interface AssigneeScopeSqlFragment {
  clause: string;
  params: string[];
}

/**
 * Fast session-only exemption (Owner / Admin / Team Lead / Guest).
 * Project Manager still requires a DB check (per-project).
 */
export const isAssigneeScopeSessionExempt = (
  session?: IPassportSession | null
): boolean => {
  if (!session) return false;
  if (hasTeamAdminPrivileges(session)) return true;
  if (isTeamLeadFromSession(session)) return true;
  if (session.is_guest === true) return true;
  return false;
};

/**
 * SQL boolean expression: requester is Owner / Admin / Team Lead for the
 * project's team. Expects aliases `p` (projects), joinable via `p.team_id`,
 * and `userIdExpression` (e.g. `$1` or `$1::UUID`).
 */
export const buildPrivilegedWorkspaceRoleExemptSql = (
  userIdExpression: string
): string => `(
  EXISTS (
    SELECT 1 FROM teams t_owner
    WHERE t_owner.id = p.team_id
      AND t_owner.user_id = ${userIdExpression}
  )
  OR EXISTS (
    SELECT 1
    FROM team_members tm_priv
    JOIN roles r_priv ON r_priv.id = tm_priv.role_id
    WHERE tm_priv.user_id = ${userIdExpression}
      AND tm_priv.team_id = p.team_id
      AND COALESCE(r_priv.name, '') IN ('Owner', 'Admin', 'Team Lead')
  )
)`;

/**
 * SQL boolean: requester is a Guest on this project (team guest flag or
 * project access level GUEST). Expects `p` projects alias and optional
 * `tm` team_members row for the same user/team when available.
 */
export const buildGuestExemptSql = (
  userIdExpression: string,
  teamMemberAlias?: string
): string => {
  const guestFlag = teamMemberAlias
    ? teamMemberIsGuestPredicate(teamMemberAlias)
    : `EXISTS (
        SELECT 1 FROM team_members tm_g
        WHERE tm_g.user_id = ${userIdExpression}
          AND tm_g.team_id = p.team_id
          AND tm_g.is_guest = TRUE
      )`;

  return `(
    ${guestFlag}
    OR EXISTS (
      SELECT 1
      FROM project_members pm_g
      JOIN project_access_levels pal_g ON pal_g.id = pm_g.project_access_level_id
      JOIN team_members tm_g2 ON tm_g2.id = pm_g.team_member_id
      WHERE pm_g.project_id = p.id
        AND tm_g2.user_id = ${userIdExpression}
        AND pal_g.key = 'GUEST'
    )
  )`;
};

/**
 * SQL predicate: task is assigned to the member, or is the parent of such a subtask.
 * `taskIdExpression` examples: `t.id`, `id`, `subtask.id`
 * `teamMemberIdParamIndex` is the $N position bound to the member's team_member_id.
 *
 * TVR-14: `tasks_assignees` is many-to-many — if the member is any one of several
 * assignees on a task, the first IN-clause matches and the task is visible.
 */
export const buildAssigneeVisibleTasksClause = (
  taskIdExpression: string,
  teamMemberIdParamIndex: number
): string => {
  const p = `$${teamMemberIdParamIndex}::UUID`;
  return `(
    ${taskIdExpression} IN (
      SELECT task_id FROM tasks_assignees WHERE team_member_id = ${p}
    )
    OR ${taskIdExpression} IN (
      SELECT parent_task_id
      FROM tasks
      WHERE parent_task_id IS NOT NULL
        AND id IN (SELECT task_id FROM tasks_assignees WHERE team_member_id = ${p})
    )
  )`;
};

/**
 * TVR-13: true when the member sees the task only as parent-of-assigned-subtask
 * (not directly assigned). Used as a SELECT expression when assignee-scope filter applies.
 */
export const buildAssigneeScopeReadonlyExpression = (
  taskIdExpression: string,
  teamMemberIdParamIndex: number
): string => {
  const p = `$${teamMemberIdParamIndex}::UUID`;
  return `(
    NOT EXISTS (
      SELECT 1 FROM tasks_assignees
      WHERE task_id = ${taskIdExpression}
        AND team_member_id = ${p}
    )
    AND EXISTS (
      SELECT 1
      FROM tasks st
      JOIN tasks_assignees ta ON ta.task_id = st.id
      WHERE st.parent_task_id = ${taskIdExpression}
        AND ta.team_member_id = ${p}
    )
  )`;
};

/**
 * Builds a WHERE fragment for a single-project query.
 * Returns empty clause when the requester is not restricted.
 */
export const buildAssigneeScopeFilter = (
  scope: AssigneeTaskScope,
  taskIdExpression: string,
  paramOffset: number
): AssigneeScopeSqlFragment => {
  if (!scope.applyFilter) {
    return { clause: "", params: [] };
  }

  if (!scope.teamMemberId) {
    return { clause: "1 = 0", params: [] };
  }

  return {
    clause: buildAssigneeVisibleTasksClause(taskIdExpression, paramOffset),
    params: [scope.teamMemberId],
  };
};

/**
 * TVR-15: progress / complete_ratio from assignee-visible subtasks only.
 * When the task itself is done → 100. When it has visible children → ratio among
 * those. Otherwise fall back to stored progress_value (leaf / no visible kids).
 */
export const buildAssigneeScopedProgressExpression = (
  taskIdExpression: string,
  teamMemberIdParamIndex: number
): string => {
  const visibleChild = buildAssigneeVisibleTasksClause(
    "st.id",
    teamMemberIdParamIndex
  );
  return `(CASE
    WHEN EXISTS(
      SELECT 1
      FROM tasks_with_status_view
      WHERE tasks_with_status_view.task_id = ${taskIdExpression}
        AND is_done IS TRUE
    ) THEN 100
    WHEN EXISTS (
      SELECT 1
      FROM tasks st
      WHERE st.parent_task_id = ${taskIdExpression}
        AND st.archived IS FALSE
        AND ${visibleChild}
    ) THEN COALESCE(
      (
        SELECT ROUND(
          100.0 * COUNT(*) FILTER (
            WHERE EXISTS (
              SELECT 1
              FROM tasks_with_status_view tw
              WHERE tw.task_id = st.id
                AND tw.is_done IS TRUE
            )
          ) / NULLIF(COUNT(*), 0)
        )::INT
        FROM tasks st
        WHERE st.parent_task_id = ${taskIdExpression}
          AND st.archived IS FALSE
          AND ${visibleChild}
      ),
      0
    )
    ELSE COALESCE(
      (SELECT progress_value FROM tasks WHERE id = ${taskIdExpression}),
      0
    )
  END)`;
};

/**
 * Multi-project filter (home calendar, team quick-search).
 * Assumes `p` is the projects alias and `$userIdParam` is the requester's user id.
 * Session Owner/Admin/Team Lead/Guest callers should skip this (pass isSessionPrivileged=true).
 * SQL still includes DB-level Owner/Admin/Team Lead/Guest/PM exemptions as a safety net.
 */
export const buildMultiProjectAssigneeScopeClause = (
  taskIdExpression: string,
  userIdParamIndex: number,
  isSessionPrivileged: boolean
): string => {
  if (isSessionPrivileged) return "";

  const u = `$${userIdParamIndex}::UUID`;
  return `AND (
    COALESCE(p.restrict_tasks_to_assignee, FALSE) = FALSE
    OR ${buildPrivilegedWorkspaceRoleExemptSql(u)}
    OR ${buildGuestExemptSql(u)}
    OR EXISTS (
      SELECT 1
      FROM project_members pm
      JOIN project_access_levels pal ON pal.id = pm.project_access_level_id
      JOIN team_members tm ON tm.id = pm.team_member_id
      WHERE pm.project_id = p.id
        AND tm.user_id = ${u}
        AND pal.key = 'PROJECT_MANAGER'
    )
    OR (
      ${taskIdExpression} IN (
        SELECT ta.task_id
        FROM tasks_assignees ta
        JOIN team_members tm ON tm.id = ta.team_member_id
        WHERE tm.user_id = ${u}
          AND tm.team_id = p.team_id
      )
      OR ${taskIdExpression} IN (
        SELECT st.parent_task_id
        FROM tasks st
        JOIN tasks_assignees ta ON ta.task_id = st.id
        JOIN team_members tm ON tm.id = ta.team_member_id
        WHERE st.parent_task_id IS NOT NULL
          AND tm.user_id = ${u}
          AND tm.team_id = p.team_id
      )
    )
  )`;
};

/**
 * Resolve whether the requester must be assignee-scoped for a project.
 */
export const resolveAssigneeTaskScope = async (
  userId: string | null | undefined,
  projectId: string | null | undefined,
  session?: IPassportSession | null
): Promise<AssigneeTaskScope> => {
  if (!userId || !projectId) {
    return { applyFilter: false, teamMemberId: null };
  }

  // TVR-17: Owner / Admin / Team Lead / Guest bypass from session immediately
  if (isAssigneeScopeSessionExempt(session)) {
    return { applyFilter: false, teamMemberId: session?.team_member_id || null };
  }

  try {
    const result = await db.query(
      `
      SELECT
        COALESCE(p.restrict_tasks_to_assignee, FALSE) AS restrict_on,
        tm.id AS team_member_id,
        ${buildPrivilegedWorkspaceRoleExemptSql("$1")} AS is_privileged_role,
        ${buildGuestExemptSql("$1", "tm")} AS is_guest,
        EXISTS (
          SELECT 1
          FROM project_members pm
          JOIN project_access_levels pal ON pal.id = pm.project_access_level_id
          WHERE pm.project_id = p.id
            AND pm.team_member_id = tm.id
            AND pal.key = 'PROJECT_MANAGER'
        ) AS is_project_manager
      FROM projects p
      LEFT JOIN team_members tm
        ON tm.team_id = p.team_id
       AND tm.user_id = $1
      WHERE p.id = $2
      LIMIT 1;
      `,
      [userId, projectId]
    );

    const row = result.rows[0];
    if (!row || row.restrict_on !== true) {
      return { applyFilter: false, teamMemberId: row?.team_member_id || null };
    }

    // TVR-17: DB-backed Owner/Admin/Team Lead/Guest + PM exemptions
    if (
      row.is_privileged_role === true ||
      row.is_guest === true ||
      row.is_project_manager === true
    ) {
      return { applyFilter: false, teamMemberId: row.team_member_id || null };
    }

    return {
      applyFilter: true,
      teamMemberId: row.team_member_id || null,
    };
  } catch (error) {
    // Fail closed: deny access + log on DB error (IDOR prevention)
    console.error(
      `[SECURITY] Database error in resolveAssigneeTaskScope for userId=${userId}, projectId=${projectId}:`,
      error
    );
    return { applyFilter: false, teamMemberId: null };
  }
};

/**
 * Whether the user may see a specific task under assignee-scope rules.
 */
export const canUserViewTask = async (
  userId: string | null | undefined,
  taskId: string | null | undefined,
  session?: IPassportSession | null
): Promise<boolean> => {
  if (!userId || !taskId) return false;

  if (isAssigneeScopeSessionExempt(session)) {
    return true;
  }

  try {
    const result = await db.query(
      `
      SELECT
        COALESCE(p.restrict_tasks_to_assignee, FALSE) AS restrict_on,
        tm.id AS team_member_id,
        ${buildGuestExemptSql("$1", "tm")} AS is_guest,
        (
          t_team.user_id = $1
          OR COALESCE(r.name, '') IN ('Owner', 'Admin', 'Team Lead')
        ) AS is_privileged_role,
        EXISTS (
          SELECT 1
          FROM project_members pm
          JOIN project_access_levels pal ON pal.id = pm.project_access_level_id
          WHERE pm.project_id = p.id
            AND pm.team_member_id = tm.id
            AND pal.key = 'PROJECT_MANAGER'
        ) AS is_project_manager,
        (
          EXISTS (
            SELECT 1 FROM tasks_assignees ta
            WHERE ta.task_id = t.id AND ta.team_member_id = tm.id
          )
          OR EXISTS (
            SELECT 1
            FROM tasks st
            JOIN tasks_assignees ta ON ta.task_id = st.id
            WHERE st.parent_task_id = t.id
              AND ta.team_member_id = tm.id
          )
        ) AS is_visible
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      JOIN teams t_team ON t_team.id = p.team_id
      LEFT JOIN team_members tm
        ON tm.team_id = p.team_id
       AND tm.user_id = $1
      LEFT JOIN roles r ON r.id = tm.role_id
      WHERE t.id = $2
      LIMIT 1;
      `,
      [userId, taskId]
    );

    const row = result.rows[0];
    if (!row) return false;
    if (row.restrict_on !== true) return true;
    if (
      row.is_guest === true ||
      row.is_project_manager === true ||
      row.is_privileged_role === true
    ) {
      return true;
    }
    return row.is_visible === true;
  } catch (error) {
    // Fail closed: deny access + log on DB error (IDOR prevention)
    console.error(
      `[SECURITY] Database error in canUserViewTask for userId=${userId}, taskId=${taskId}:`,
      error
    );
    return false;
  }
};

/**
 * Batched form of canUserViewTask — one query for many candidate userIds
 * instead of one round-trip per user. Used by emitToTaskVisibleProjectMembers
 * so broadcasting a single task event to a project room doesn't serially
 * query the DB once per connected socket.
 */
export const getUsersWhoCanViewTask = async (
  userIds: string[],
  taskId: string | null | undefined
): Promise<Set<string>> => {
  const viewable = new Set<string>();
  if (!taskId || !userIds.length) return viewable;

  try {
    const result = await db.query(
      `
      SELECT
        tm.user_id,
        COALESCE(p.restrict_tasks_to_assignee, FALSE) AS restrict_on,
        ${buildGuestExemptSql("tm.user_id", "tm")} AS is_guest,
        (
          t_team.user_id = tm.user_id
          OR COALESCE(r.name, '') IN ('Owner', 'Admin', 'Team Lead')
        ) AS is_privileged_role,
        EXISTS (
          SELECT 1
          FROM project_members pm
          JOIN project_access_levels pal ON pal.id = pm.project_access_level_id
          WHERE pm.project_id = p.id
            AND pm.team_member_id = tm.id
            AND pal.key = 'PROJECT_MANAGER'
        ) AS is_project_manager,
        (
          EXISTS (
            SELECT 1 FROM tasks_assignees ta
            WHERE ta.task_id = t.id AND ta.team_member_id = tm.id
          )
          OR EXISTS (
            SELECT 1
            FROM tasks st
            JOIN tasks_assignees ta ON ta.task_id = st.id
            WHERE st.parent_task_id = t.id
              AND ta.team_member_id = tm.id
          )
        ) AS is_visible
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      JOIN teams t_team ON t_team.id = p.team_id
      JOIN team_members tm
        ON tm.team_id = p.team_id
       AND tm.user_id = ANY($1::uuid[])
      LEFT JOIN roles r ON r.id = tm.role_id
      WHERE t.id = $2;
      `,
      [userIds, taskId]
    );

    for (const row of result.rows) {
      const canView =
        row.restrict_on !== true ||
        row.is_guest === true ||
        row.is_project_manager === true ||
        row.is_privileged_role === true ||
        row.is_visible === true;
      if (canView) viewable.add(row.user_id);
    }
  } catch (error) {
    // Fail closed: on DB error, treat as no one visible (IDOR prevention)
    console.error(
      `[SECURITY] Database error in getUsersWhoCanViewTask for taskId=${taskId}:`,
      error
    );
  }

  return viewable;
};

/**
 * Whether the user may mutate a task under assignee-scope rules (TVR-13).
 * Direct assignees (including any of multiple — TVR-14) may edit.
 * Parent-context-only and notification-exception viewers may view but not edit.
 */
export const canUserEditTask = async (
  userId: string | null | undefined,
  taskId: string | null | undefined,
  session?: IPassportSession | null
): Promise<boolean> => {
  if (!userId || !taskId) return false;

  if (isAssigneeScopeSessionExempt(session)) {
    return true;
  }

  try {
    const result = await db.query(
      `
      SELECT
        COALESCE(p.restrict_tasks_to_assignee, FALSE) AS restrict_on,
        tm.id AS team_member_id,
        ${buildGuestExemptSql("$1", "tm")} AS is_guest,
        (
          t_team.user_id = $1
          OR COALESCE(r.name, '') IN ('Owner', 'Admin', 'Team Lead')
        ) AS is_privileged_role,
        EXISTS (
          SELECT 1
          FROM project_members pm
          JOIN project_access_levels pal ON pal.id = pm.project_access_level_id
          WHERE pm.project_id = p.id
            AND pm.team_member_id = tm.id
            AND pal.key = 'PROJECT_MANAGER'
        ) AS is_project_manager,
        EXISTS (
          SELECT 1 FROM tasks_assignees ta
          WHERE ta.task_id = t.id AND ta.team_member_id = tm.id
        ) AS is_directly_assigned
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      JOIN teams t_team ON t_team.id = p.team_id
      LEFT JOIN team_members tm
        ON tm.team_id = p.team_id
       AND tm.user_id = $1
      LEFT JOIN roles r ON r.id = tm.role_id
      WHERE t.id = $2
      LIMIT 1;
      `,
      [userId, taskId]
    );

    const row = result.rows[0];
    if (!row) return false;
    if (row.restrict_on !== true) return true;
    if (
      row.is_guest === true ||
      row.is_project_manager === true ||
      row.is_privileged_role === true
    ) {
      return true;
    }
    return row.is_directly_assigned === true;
  } catch (error) {
    // Fail closed: deny access + log on DB error (IDOR prevention)
    console.error(
      `[SECURITY] Database error in canUserEditTask for userId=${userId}, taskId=${taskId}:`,
      error
    );
    return false;
  }
};

/** Inverse of canUserEditTask for socket/API early-returns. */
export const isAssigneeScopeEditRestrictedForTask = async (
  userId: string | null | undefined,
  taskId: string | null | undefined,
  session?: IPassportSession | null
): Promise<boolean> => {
  return !(await canUserEditTask(userId, taskId, session));
};

/**
 * Parent-context read-only flag for a single task (for /info responses).
 * False when setting is off, user is exempt, or user is directly assigned.
 */
export const isAssigneeScopeReadonlyForTask = async (
  userId: string | null | undefined,
  taskId: string | null | undefined,
  session?: IPassportSession | null
): Promise<boolean> => {
  if (!userId || !taskId) return false;

  if (isAssigneeScopeSessionExempt(session)) {
    return false;
  }

  try {
    const result = await db.query(
      `
      SELECT
        COALESCE(p.restrict_tasks_to_assignee, FALSE) AS restrict_on,
        tm.id AS team_member_id,
        ${buildGuestExemptSql("$1", "tm")} AS is_guest,
        (
          t_team.user_id = $1
          OR COALESCE(r.name, '') IN ('Owner', 'Admin', 'Team Lead')
        ) AS is_privileged_role,
        EXISTS (
          SELECT 1
          FROM project_members pm
          JOIN project_access_levels pal ON pal.id = pm.project_access_level_id
          WHERE pm.project_id = p.id
            AND pm.team_member_id = tm.id
            AND pal.key = 'PROJECT_MANAGER'
        ) AS is_project_manager,
        EXISTS (
          SELECT 1 FROM tasks_assignees ta
          WHERE ta.task_id = t.id AND ta.team_member_id = tm.id
        ) AS is_directly_assigned,
        EXISTS (
          SELECT 1
          FROM tasks st
          JOIN tasks_assignees ta ON ta.task_id = st.id
          WHERE st.parent_task_id = t.id
            AND ta.team_member_id = tm.id
        ) AS is_parent_of_assigned_subtask
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      JOIN teams t_team ON t_team.id = p.team_id
      LEFT JOIN team_members tm
        ON tm.team_id = p.team_id
       AND tm.user_id = $1
      LEFT JOIN roles r ON r.id = tm.role_id
      WHERE t.id = $2
      LIMIT 1;
      `,
      [userId, taskId]
    );

    const row = result.rows[0];
    if (!row || row.restrict_on !== true) return false;
    if (
      row.is_guest === true ||
      row.is_project_manager === true ||
      row.is_privileged_role === true
    ) {
      return false;
    }
    if (row.is_directly_assigned === true) return false;
    return row.is_parent_of_assigned_subtask === true;
  } catch (error) {
    // Fail closed: deny access + log on DB error (IDOR prevention)
    console.error(
      `[SECURITY] Database error in isAssigneeScopeReadonlyForTask for userId=${userId}, taskId=${taskId}:`,
      error
    );
    return true; // Treat as read-only (conservative)
  }
};

export const TASK_ASSIGNEE_RESTRICTED_CODE = "TASK_ASSIGNEE_RESTRICTED";
export const TASK_ASSIGNEE_READONLY_CODE = "TASK_ASSIGNEE_READONLY";

/**
 * True when the user has an in-app notification for the task, or was @mentioned
 * on a comment on that task. Used for TVR-12 single-task view exception.
 */
export const hasNotificationOrMentionTaskAccess = async (
  userId: string | null | undefined,
  taskId: string | null | undefined
): Promise<boolean> => {
  if (!userId || !taskId) return false;

  try {
    const result = await db.query(
      `
      SELECT (
        EXISTS (
          SELECT 1
          FROM user_notifications
          WHERE user_id = $1
            AND task_id = $2
        )
        OR EXISTS (
          SELECT 1
          FROM task_comment_mentions tcm
          JOIN task_comments tc ON tc.id = tcm.comment_id
          JOIN team_members tm ON tm.id = tcm.informed_by
          WHERE tc.task_id = $2
            AND tm.user_id = $1
        )
      ) AS has_access;
      `,
      [userId, taskId]
    );

    return result.rows[0]?.has_access === true;
  } catch {
    return false;
  }
};

export interface TaskDetailAccessOptions {
  /**
   * When true, the notification/mention exception only applies if the request
   * carries from=notification|mention (deep-link / that URL only).
   */
  requireNotificationLink?: boolean;
  notificationLinkFrom?: string | null;
}

/**
 * Detail/API access under assignee-scope: visible assignee tasks, or the
 * notification/mention exception (optionally gated by the deep-link signal).
 */
export const canUserAccessTaskDetail = async (
  userId: string | null | undefined,
  taskId: string | null | undefined,
  session?: IPassportSession | null,
  options?: TaskDetailAccessOptions
): Promise<boolean> => {
  if (await canUserViewTask(userId, taskId, session)) {
    return true;
  }

  const hasProof = await hasNotificationOrMentionTaskAccess(userId, taskId);
  if (!hasProof) {
    return false;
  }

  if (!options?.requireNotificationLink) {
    return true;
  }

  const from = (options.notificationLinkFrom || "").toLowerCase();
  return from === "notification" || from === "mention";
};

const getIoFromSocketOrServer = (ioOrSocket: Server | Socket): Server | null => {
  if ("sockets" in ioOrSocket && typeof (ioOrSocket as Server).in === "function") {
    return ioOrSocket as Server;
  }
  return (ioOrSocket as Socket).nsp?.server || null;
};

/**
 * Emit a task event only to project-room members who are allowed to see the task.
 * When the project setting is OFF, falls back to a normal room broadcast.
 */
export const emitToTaskVisibleProjectMembers = async (
  ioOrSocket: Server | Socket,
  projectId: string,
  taskId: string,
  event: string,
  payload: unknown,
  options?: { excludeSocketId?: string }
): Promise<void> => {
  if (!projectId || !taskId || !event) return;

  try {
    const restrictResult = await db.query(
      `SELECT COALESCE(restrict_tasks_to_assignee, FALSE) AS restrict_on
       FROM projects WHERE id = $1 LIMIT 1;`,
      [projectId]
    );
    const restrictOn = restrictResult.rows[0]?.restrict_on === true;

    const io = getIoFromSocketOrServer(ioOrSocket);
    if (!io) return;

    if (!restrictOn) {
      if (options?.excludeSocketId) {
        io.to(projectId).except(options.excludeSocketId).emit(event, payload);
      } else {
        io.to(projectId).emit(event, payload);
      }
      return;
    }

    const clients = await io.in(projectId).fetchSockets();
    const socketIds = clients.map((client) => client.id);
    if (!socketIds.length) return;

    const usersResult = await db.query(
      `
      SELECT u.id, u.socket_id
      FROM users u
      WHERE u.socket_id = ANY($1::text[]);
      `,
      [socketIds]
    );

    const userBySocketId = new Map<string, string>();
    for (const row of usersResult.rows) {
      if (row.socket_id) {
        userBySocketId.set(row.socket_id, row.id);
      }
    }

    const candidateUserIds = Array.from(new Set(userBySocketId.values()));
    const viewableUserIds = await getUsersWhoCanViewTask(candidateUserIds, taskId);

    for (const client of clients) {
      if (options?.excludeSocketId && client.id === options.excludeSocketId) {
        continue;
      }

      const userId = userBySocketId.get(client.id);
      if (!userId) continue;

      if (viewableUserIds.has(userId)) {
        client.emit(event, payload);
      }
    }
  } catch (error) {
    // Fail closed: log error and don't broadcast on DB failure (IDOR prevention)
    console.error(
      `[SECURITY] Database error in emitToTaskVisibleProjectMembers for projectId=${projectId}, taskId=${taskId}:`,
      error
    );
  }
};
