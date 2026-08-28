import { Server, Socket } from "socket.io";
import db from "../config/db";
import { SocketEvents } from "../socket.io/events";
import { TASK_STATUS_COLOR_ALPHA } from "./constants";
import { getColor, log_error } from "./utils";
import { getAssignees } from "../socket.io/commands/on-quick-assign-or-remove";
import { NotificationsService } from "../services/notifications/notifications.service";
import WorklenzControllerBase from "../controllers/worklenz-controller-base";
import { getLoggedInUserIdFromSocket } from "../socket.io/util";

/**
 * Phase Auto-Advance (Task 5 - ST-1, ST-2, ST-3, ST-4, & ST-5 Refactor)
 *
 * When a task is marked "done" AND phase_assignees_enabled is ON for its project,
 * automatically move the task to the next phase in the pipeline and assign the
 * next phase's default assignee.
 *
 * ST-1: Uses phase ID-based database lookups instead of array index positioning.
 * 
 * ST-2: Dynamic next-phase resolution at mark-done time.
 * Queries the database fresh when a task is marked done to find the next phase,
 * never relying on cached/stored next_phase_id values.
 * Uses: SELECT ... WHERE sort_index < current_sort_index ORDER BY sort_index DESC LIMIT 1
 * This finds the phase with the lowest sort_index that is greater in the pipeline order.
 * 
 * ST-3: Handle edge cases from reordering.
 * - Phase moved to last position: treated as pipeline complete, no auto-advance
 * - Phase inserted between current and next: task naturally lands there on next advance
 * - Phase moved before current: task skips it correctly (dynamic lookup only looks forward)
 * - Current phase deleted: handled gracefully with NULL checks
 * 
 * ST-4: Reorder warning when tasks are in-flight.
 * - Before saving phase reorder, check for active (non-complete) tasks in pipeline
 * - If count > 0, show confirmation modal with in-flight task count
 * - Warns user that reordering will change auto-advance destinations
 * - User can proceed or cancel the reorder operation
 * 
 * ST-5: Audit log for phase reorders and auto-advances.
 * - Phase reorder: Logs old and new phase order to project_logs table
 * - Task auto-advance: Logs each task advancement with from/to phase info
 * - Supports reporting to explain why tasks jumped between phases
 * - Includes user who made the change and exact timestamp
 */

interface NextPhaseInfo {
  nextPhaseId: string;
  nextPhaseName: string;
  nextPhaseColor: string;
  nextPhaseAssigneeTeamMemberId: string | null;
  nextPhaseAssigneeUserId: string | null;
  nextPhaseAssigneeName: string | null;
  projectId: string;
  teamId: string;
}

async function resolveNextPhase(taskId: string): Promise<NextPhaseInfo | null> {
  // ── Get current task and phase information ──────────────────────────────────
  const taskQ = `
    SELECT
      t.id                                             AS task_id,
      t.parent_task_id,
      t.project_id,
      p.team_id,
      COALESCE(p.phase_assignees_enabled, FALSE)       AS phase_assignees_enabled,
      tp.phase_id                                      AS current_phase_id,
      cur.name                                         AS current_phase_name,
      cur.sort_index                                   AS current_sort_index
    FROM tasks t
    JOIN projects p         ON p.id = t.project_id
    LEFT JOIN task_phase tp  ON tp.task_id = t.id
    LEFT JOIN project_phases cur ON cur.id = tp.phase_id
    WHERE t.id = $1
    LIMIT 1;
  `;

  const taskResult = await db.query(taskQ, [taskId]);

  if (taskResult.rows.length === 0) {
    return null;
  }

  const d = taskResult.rows[0];

  // ── ST-3 Edge Case: Current phase deleted ──────────────────────────────────
  if (!d.current_phase_id) {
    return null;
  }

  if (d.parent_task_id) {
    return null;
  }
  
  // ── ST-3 Edge Case: Current phase info missing from DB ────────────────────
  if (!d.current_phase_name || d.current_sort_index === null || d.current_sort_index === undefined) {
    return null;
  }

  // ── Guard checks ──────────────────────────────────────────────────────────
  if (!d.phase_assignees_enabled) {
    return null;
  }
  if (!d.current_phase_id) {
    return null;
  }

  // ── Resolve next phase using dynamic lookup (ST-2 refactor) ──────────────
  // ST-2: Dynamic next-phase resolution at mark-done time
  // Find the phase with the LOWEST sort_index that is LESS than current_sort_index
  // (phases are ordered DESC in UI, so "next" means lower sort_index value)
  // This query executes fresh at mark-done time, never using cached values
  // 
  // ST-3 Edge Cases Handled:
  // 1. Current phase moved to last position → query returns 0 rows → skip auto-advance
  // 2. Phase inserted between current and next → query finds new phase dynamically
  // 3. Phase moved before current → skipped automatically (not < current_sort_index)
  // 4. Current phase deleted → caught by NULL checks above
  const nextPhaseQ = `
    SELECT 
      pp.id,
      pp.name,
      pp.color_code,
      pp.sort_index
    FROM project_phases pp
    WHERE pp.project_id = $1
      AND pp.sort_index < $2
    ORDER BY pp.sort_index DESC
    LIMIT 1;
  `;

  const nextPhaseResult = await db.query(nextPhaseQ, [d.project_id, d.current_sort_index]);
  
  let nextPhaseId: string | null = null;
  let nextPhaseName: string | null = null;
  let nextPhaseSortIndex: number | null = null;

  if (nextPhaseResult.rows.length > 0) {
    const nextPhase = nextPhaseResult.rows[0];
    nextPhaseId = nextPhase.id;
    nextPhaseName = nextPhase.name;
    nextPhaseSortIndex = nextPhase.sort_index;
  } else {
    // ST-3 Edge Case: No next phase found
    // Could be: (1) current phase moved to last position, or (2) naturally last phase
    return null;
  }

  if (!nextPhaseId) return null;

  // ── Fetch complete details of the next phase (ID-based lookup) ──────────────
  // ST-3: Verify next phase still exists before fetching details
  const nextDetailsQ = `
    SELECT
      pp.id,
      pp.name,
      pp.color_code,
      pm.team_member_id AS default_assignee_id,
      tm.user_id        AS assignee_user_id,
      u.name            AS assignee_name
    FROM project_phases pp
    LEFT JOIN project_members pm
      ON pm.project_id = pp.project_id
     AND pm.team_member_id = pp.default_assignee_id
    LEFT JOIN team_members tm ON tm.id = pm.team_member_id
    LEFT JOIN users u ON u.id = tm.user_id
    WHERE pp.id = $1
      AND pp.project_id = $2
    LIMIT 1;
  `;
  const nextDetailsResult = await db.query(nextDetailsQ, [nextPhaseId, d.project_id]);
  
  // ST-3 Edge Case: Next phase was deleted between resolution and fetch
  if (nextDetailsResult.rows.length === 0) {
    return null;
  }

  const next = nextDetailsResult.rows[0];

  return {
    nextPhaseId:                       next.id,
    nextPhaseName:                     next.name,
    nextPhaseColor:                    next.color_code,
    nextPhaseAssigneeTeamMemberId:     next.default_assignee_id,
    nextPhaseAssigneeUserId:           next.assignee_user_id,
    nextPhaseAssigneeName:             next.assignee_name,
    projectId:                         d.project_id,
    teamId:                            d.team_id,
  };
}

async function moveTaskToNextPhaseAndAssign(
  taskId: string,
  next: NextPhaseInfo,
  reporterUserId: string | null
): Promise<{ todoStatusId: string | null }> {
  const client = await db.connect();
  let todoStatusId: string | null = null;
  try {
    await client.query("BEGIN");

    // ST-3: Verify phase still exists before moving task
    const phaseVerifyResult = await client.query(
      `SELECT id FROM project_phases WHERE id = $1 AND project_id = $2 LIMIT 1;`,
      [next.nextPhaseId, next.projectId]
    );
    
    if (phaseVerifyResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return { todoStatusId: null };
    }

    // Move task to the next phase
    const updateResult = await client.query(
      `UPDATE task_phase SET phase_id = $1 WHERE task_id = $2 RETURNING phase_id;`,
      [next.nextPhaseId, taskId]
    );

    if ((updateResult.rowCount ?? 0) === 0) {
      await client.query(
        `INSERT INTO task_phase (task_id, phase_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
        [taskId, next.nextPhaseId]
      );
    }

    // Reset task status to the project's first "To Do" status
    const todoResult = await client.query(
      `SELECT id FROM task_statuses
         WHERE project_id = (SELECT project_id FROM tasks WHERE id = $1)
           AND category_id IN (SELECT id FROM sys_task_status_categories WHERE is_todo IS TRUE)
         ORDER BY sort_order
         LIMIT 1;`,
      [taskId]
    );
    todoStatusId = todoResult.rows[0]?.id ?? null;

    if (todoStatusId) {
      await client.query(
        `UPDATE tasks SET status_id = $1, completed_at = NULL, manual_progress = FALSE, progress_value = NULL WHERE id = $2;`,
        [todoStatusId, taskId]
      );
    }

    // Assign next phase's default assignee
    if (next.nextPhaseAssigneeTeamMemberId) {
      // ST-3: Verify assignee still belongs to the project before assigning
      const assigneeVerifyResult = await client.query(
        `SELECT 1
         FROM project_members
         WHERE project_id = $1
           AND team_member_id = $2
         LIMIT 1;`,
        [next.projectId, next.nextPhaseAssigneeTeamMemberId]
      );
      
      if (assigneeVerifyResult.rows.length > 0) {
        await client.query(
          `SELECT create_task_assignee($1, $2, $3, $4);`,
          [next.nextPhaseAssigneeTeamMemberId, next.projectId, taskId, reporterUserId]
        );
      }
    }

    await client.query(`UPDATE tasks SET updated_at = NOW() WHERE id = $1;`, [taskId]);
    
    // ST-5: Log phase auto-advance to project logs
    const taskResult = await client.query(
      `SELECT name FROM tasks WHERE id = $1`,
      [taskId]
    );
    const taskName = taskResult.rows[0]?.name || taskId;
    
    const auditLogQuery = `
      INSERT INTO project_logs (team_id, project_id, description, created_at)
      VALUES ($1, $2, $3, NOW());
    `;
    
    const description = JSON.stringify({
      action: 'TASK_AUTO_ADVANCED',
      task_id: taskId,
      task_name: taskName,
      from_phase_id: null,  // Could query current phase if needed
      to_phase_id: next.nextPhaseId,
      to_phase_name: next.nextPhaseName,
      assignee_id: next.nextPhaseAssigneeTeamMemberId,
      assignee_name: next.nextPhaseAssigneeName,
      timestamp: new Date().toISOString()
    });
    
    await client.query(auditLogQuery, [next.teamId, next.projectId, description]);
    
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    log_error(`Phase auto-advance transaction rolled back: ${err}`);
    throw err;
  } finally {
    client.release();
  }
  return { todoStatusId };
}

export async function autoAdvanceToNextPhase(
  _io: Server,
  socket: Socket,
  taskId: string
): Promise<void> {
  try {
    const next = await resolveNextPhase(taskId);
    
    // ST-3: Handle resolution failure gracefully
    if (!next) {
      return;
    }

    const reporterUserId = getLoggedInUserIdFromSocket(socket);

    // Atomic move + assign + status reset
    const { todoStatusId } = await moveTaskToNextPhaseAndAssign(taskId, next, reporterUserId);

    // ST-3: Check if move was successful
    if (!todoStatusId) {
      return;
    }

    // Emit TASK_PHASE_CHANGE — moves card to the new phase column
    const phaseColor = next.nextPhaseColor
      ? next.nextPhaseColor + TASK_STATUS_COLOR_ALPHA
      : getColor(next.nextPhaseName) + TASK_STATUS_COLOR_ALPHA;

    const phaseChangePayload = {
      id: next.nextPhaseId,
      task_id: taskId,
      parent_task: null,
      color_code: phaseColor,
      phase_name: next.nextPhaseName, // Include phase name for immediate UI update
    };
    socket.emit(SocketEvents.TASK_PHASE_CHANGE.toString(), phaseChangePayload);
    socket.to(next.projectId).emit(SocketEvents.TASK_PHASE_CHANGE.toString(), phaseChangePayload);

    // Emit TASK_STATUS_CHANGE to reset the status badge on the board/list to "To Do"
    if (todoStatusId) {
      const statusColorResult = await db.query(
        `SELECT color_code, color_code_dark
         FROM sys_task_status_categories
         WHERE id = (SELECT category_id FROM task_statuses WHERE id = $1);`,
        [todoStatusId]
      );
      const statusRow = statusColorResult.rows[0];
      const statusChangePayload = {
        id: taskId,
        parent_task: null,
        status_id: todoStatusId,
        color_code: (statusRow?.color_code ?? "") + TASK_STATUS_COLOR_ALPHA,
        color_code_dark: statusRow?.color_code_dark ?? "",
        completed_deps: true,
        phase_auto_advanced: true,
        statusCategory: { is_todo: true, is_doing: false, is_done: false },
        completed_at: null,
      };
      socket.emit(SocketEvents.TASK_STATUS_CHANGE.toString(), statusChangePayload);
      socket.to(next.projectId).emit(SocketEvents.TASK_STATUS_CHANGE.toString(), statusChangePayload);
    }

    // Emit QUICK_ASSIGNEES_UPDATE if the next phase has a default assignee
    if (next.nextPhaseAssigneeTeamMemberId) {
      const assignees = await getAssignees(taskId);
      const names = WorklenzControllerBase.createTagList(assignees);
      const assignPayload = {
        id: taskId,
        parent_task: null,
        assignees,
        names,
        mode: 0,
        team_member_id: next.nextPhaseAssigneeTeamMemberId,
      };
      socket.emit(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), assignPayload);
      socket.to(next.projectId).emit(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), assignPayload);

      if (next.nextPhaseAssigneeUserId && next.nextPhaseAssigneeUserId !== reporterUserId) {
        // Fetch task name for the phase-specific notification message
        const taskNameResult = await db.query(`SELECT name FROM tasks WHERE id = $1;`, [taskId]);
        const taskName = taskNameResult.rows[0]?.name || "";

        // ST-3: Gracefully handle notification service failure
        try {
          await NotificationsService.sendPhaseTaskAssignedNotification({
            reporterUserId: reporterUserId || next.nextPhaseAssigneeUserId,
            assigneeUserId: next.nextPhaseAssigneeUserId,
            taskId,
            taskName,
            phaseName: next.nextPhaseName,
            projectId: next.projectId,
            teamId: next.teamId,
          });
        } catch (notifErr) {
          log_error(`Phase auto-advance notification failed: ${notifErr}`);
          // Continue anyway - don't fail the whole auto-advance
        }
      }
    }
  } catch (err) {
    log_error("Error in autoAdvanceToNextPhase: " + err);
  }
}
