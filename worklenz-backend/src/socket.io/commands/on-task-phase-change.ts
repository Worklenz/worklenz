import {Server, Socket} from "socket.io";

import db from "../../config/db";
import {TASK_STATUS_COLOR_ALPHA, UNMAPPED} from "../../shared/constants";
import {SocketEvents} from "../events";
import {getLoggedInUserIdFromSocket, log_error, notifyProjectUpdates} from "../util";
import {getColor} from "../../shared/utils";
import { getTaskPhaseDetails, logPhaseChange } from "../../services/activity-logs/activity-logs.service";
import { getAssignees, runAssignOrRemove } from "./on-quick-assign-or-remove";
import WorklenzControllerBase from "../../controllers/worklenz-controller-base";

async function autoAssignPhaseAssignee(
  io: Server,
  socket: Socket,
  taskId: string,
  phaseId: string,
  previousPhaseId: string | null
): Promise<void> {
  try {
    // Fetch project info and phase_assignees_enabled flag
    const projectCheckQ = `
      SELECT
        p.phase_assignees_enabled,
        t.project_id,
        p.team_id
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      WHERE t.id = $1;
    `;
    const projectResult = await db.query(projectCheckQ, [taskId]);
    if (projectResult.rows.length === 0 || !projectResult.rows[0].phase_assignees_enabled) {
      return; // feature off
    }

    const { project_id, team_id } = projectResult.rows[0];

    // Step 1: If there's a previous phase with a default assignee, remove it
    if (previousPhaseId) {
      const prevPhaseQ = `
        SELECT pp.default_assignee_id
        FROM project_phases pp
        JOIN project_members pm
          ON pm.project_id = pp.project_id
         AND pm.team_member_id = pp.default_assignee_id
        WHERE pp.id = $1
          AND pp.project_id = $2;
      `;
      const prevPhaseResult = await db.query(prevPhaseQ, [previousPhaseId, project_id]);
      
      if (prevPhaseResult.rows.length > 0 && prevPhaseResult.rows[0].default_assignee_id) {
        const prevAssigneeId = prevPhaseResult.rows[0].default_assignee_id;
        
        // Check if the task currently has this assignee
        const hasAssigneeQ = `
          SELECT 1
          FROM task_assignees
          WHERE task_id = $1 AND team_member_id = $2
          LIMIT 1;
        `;
        const hasAssigneeResult = await db.query(hasAssigneeQ, [taskId, prevAssigneeId]);
        
        if (hasAssigneeResult.rows.length > 0) {
          // Remove the previous phase's default assignee
          const removeData = {
            task_id: taskId,
            team_member_id: prevAssigneeId,
            project_id,
          };
          await runAssignOrRemove(removeData, false);
          console.log(`[Phase Auto-Assign] Removed previous phase assignee ${prevAssigneeId} from task ${taskId}`);
        }
      }
    }

    // Step 2: Assign the new phase's default assignee
    const q = `
      SELECT
        pp.default_assignee_id AS team_member_id,
        tm.user_id              AS reporter_user_id
      FROM project_phases pp
      JOIN project_members pm
        ON pm.project_id = pp.project_id
       AND pm.team_member_id = pp.default_assignee_id
      JOIN team_members tm ON tm.id = pm.team_member_id
      WHERE pp.id = $1
        AND pp.project_id = $2
        AND pp.default_assignee_id IS NOT NULL;
    `;
    const result = await db.query(q, [phaseId, project_id]);
    if (result.rows.length === 0) return; // phase has no default assignee

    const { team_member_id, reporter_user_id } = result.rows[0];
    if (!team_member_id) return;

    // Assign the phase default assignee to this task
    const assignmentData = {
      team_member_id,
      project_id,
      task_id: taskId,
      reporter_id: reporter_user_id || getLoggedInUserIdFromSocket(socket),
    };

    await runAssignOrRemove(assignmentData, true);
    console.log(`[Phase Auto-Assign] Assigned new phase assignee ${team_member_id} to task ${taskId}`);

    // Bump task updated_at
    await db.query(`UPDATE tasks SET updated_at = NOW() WHERE id = $1;`, [taskId]);

    // Fetch updated assignees for real-time board update
    const assignees = await getAssignees(taskId);
    const names = WorklenzControllerBase.createTagList(assignees);

    // Emit so every connected client updates the task card immediately
    socket.emit(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), {
      id: taskId,
      parent_task: null,
      assignees,
      names,
      mode: 0, // assign
      team_member_id,
    });

    // Also broadcast to other clients in the project room
    socket.to(project_id).emit(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), {
      id: taskId,
      parent_task: null,
      assignees,
      names,
      mode: 0,
      team_member_id,
    });
  } catch (err) {
    log_error("Error in autoAssignPhaseAssignee: " + err);
    // Non-fatal — don't propagate, the phase change itself already succeeded
  }
}

export async function on_task_phase_change(_io: Server, socket: Socket, body?: any) {
  try {
    if (!body?.task_id) return;

    const q2 = `SELECT handle_on_task_phase_change($1, $2) AS res;`;

    const phaseId = !body.phase_id || (body.phase_id === UNMAPPED) ? null : body.phase_id;

    const task_data = await getTaskPhaseDetails(body.task_id);
    const previousPhaseId = task_data.phase_id || null; // Get phase before change

    const result = await db.query(q2, [body.task_id, phaseId]);
    const [d] = result.rows;
    const changeResponse = d.res;

    // Bump task updated_at so "Updated X ago" reflects the phase change
    await db.query(`UPDATE tasks SET updated_at = NOW() WHERE id = $1;`, [body.task_id]);

    changeResponse.color_code = changeResponse.color_code
      ? changeResponse.color_code : getColor(changeResponse.name) + TASK_STATUS_COLOR_ALPHA;

    // Get phase name if not in changeResponse
    let phaseName: string | null = changeResponse.name || null;
    if (phaseId && !phaseName) {
      const phaseQuery = await db.query(
        `SELECT name FROM project_phases WHERE id = $1`,
        [phaseId]
      );
      if (phaseQuery.rows.length > 0) {
        phaseName = phaseQuery.rows[0].name;
      }
    }

    socket.emit(SocketEvents.TASK_PHASE_CHANGE.toString(), {
      id: body.phase_id,
      task_id: body.task_id,
      parent_task: body.parent_task,
      color_code: changeResponse.color_code,
      status_id: body.status_id,
      name: phaseName
    });

    // Auto-assign the phase default assignee if feature is enabled
    // Pass both new phaseId and previous phase ID for removal logic
    if (phaseId) {
      await autoAssignPhaseAssignee(_io, socket, body.task_id, phaseId, previousPhaseId);
    }

    logPhaseChange({
      task_id: body.task_id,
      socket,
      new_value: phaseId ? phaseId : null,
      old_value: previousPhaseId
    });

    void notifyProjectUpdates(socket, body.task_id);
  } catch (error) {
    log_error(error);
  }
}
