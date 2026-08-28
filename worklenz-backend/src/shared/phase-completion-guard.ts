import db from "../config/db";

/**
 * Phase Completion Guard
 *
 * When `phase_assignees_enabled` is TRUE for a project and a task is in a phase
 * that has a `default_assignee_id`, only that assignee (or an admin/owner) may
 * move the task to a "done" status.
 *
 * Returns null when the action is allowed, or an object with the blocker's name
 * when it is blocked.
 */

interface PhaseGuardResult {
  blocked: boolean;
  blockerName: string | null; // Display name of the phase assignee who should complete it
}

/**
 * Check whether the given user is allowed to mark the given task as done.
 *
 * Fails open (returns not-blocked) on any DB error so a transient issue never
 * prevents legitimate edits.
 */
export async function checkPhaseCompletionGuard(
  userId: string | null | undefined,
  taskId: string | null | undefined,
  newStatusId: string | null | undefined
): Promise<PhaseGuardResult> {
  const allowed: PhaseGuardResult = { blocked: false, blockerName: null };

  if (!userId || !taskId || !newStatusId) return allowed;

  try {
    const q = `
      SELECT
        -- Is the new status a "done" category?
        stsc.is_done                                   AS is_done_status,

        -- Does the project have phase_assignees_enabled = TRUE?
        COALESCE(p.phase_assignees_enabled, FALSE)     AS phase_assignees_enabled,

        -- Team member ID of the phase's default assignee (null if not set)
        phase_pm.team_member_id                        AS phase_assignee_team_member_id,

        -- Display name of the phase assignee
        phase_u.name                                   AS phase_assignee_name,

        -- Team member ID of the current user (in this project's team)
        (SELECT tm.id
           FROM team_members tm
          WHERE tm.user_id = $1
            AND tm.team_id = p.team_id
          LIMIT 1)                                     AS current_user_team_member_id,

        -- Is the current user an admin / owner in this team?
        COALESCE(
          (SELECT (r.admin_role OR r.owner)
             FROM team_members tm
             JOIN roles r ON tm.role_id = r.id
            WHERE tm.user_id = $1
              AND tm.team_id = p.team_id
            LIMIT 1),
          FALSE
        )                                              AS is_admin_or_owner

      FROM tasks t
      JOIN projects p          ON p.id = t.project_id
      JOIN task_statuses ts    ON ts.id = $3
      JOIN sys_task_status_categories stsc ON stsc.id = ts.category_id

      -- Left-join to phase: task may not be in any phase
      LEFT JOIN task_phase tp  ON tp.task_id = t.id
      LEFT JOIN project_phases pp ON pp.id = tp.phase_id AND pp.project_id = p.id
      LEFT JOIN project_members phase_pm
        ON phase_pm.project_id = p.id
       AND phase_pm.team_member_id = pp.default_assignee_id
      LEFT JOIN team_members phase_tm ON phase_tm.id = phase_pm.team_member_id
      LEFT JOIN users phase_u ON phase_u.id = phase_tm.user_id

      WHERE t.id = $2
      LIMIT 1;
    `;

    const result = await db.query(q, [userId, taskId, newStatusId]);
    if (result.rows.length === 0) return allowed;

    const row = result.rows[0];

    // Only gate "done" status transitions
    if (!row.is_done_status) return allowed;

    // Feature must be enabled for this project
    if (!row.phase_assignees_enabled) return allowed;

    // If the task is not in a phase, or the phase has no default assignee → allow
    if (!row.phase_assignee_team_member_id) return allowed;

    // Admins and owners can always proceed
    if (row.is_admin_or_owner) return allowed;

    // Allow if the current user IS the phase assignee
    if (
      row.current_user_team_member_id &&
      row.current_user_team_member_id === row.phase_assignee_team_member_id
    ) {
      return allowed;
    }

    // Blocked — return the assignee's name so the frontend can show a helpful message
    return {
      blocked: true,
      blockerName: row.phase_assignee_name || null,
    };
  } catch {
    // Fail open — a DB error must never prevent a status change
    return allowed;
  }
}
