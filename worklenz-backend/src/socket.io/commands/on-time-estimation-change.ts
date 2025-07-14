import { Server, Socket } from "socket.io";
import db from "../../config/db";
import TasksController from "../../controllers/tasks-controller";
import { SocketEvents } from "../events";

import { log_error, notifyProjectUpdates } from "../util";
import { getTaskDetails, logTotalMinutes } from "../../services/activity-logs/activity-logs.service";

/**
 * Recursively updates all ancestor tasks' progress when a subtask changes
 * @param io Socket.io instance
 * @param socket Socket instance for emitting events
 * @param projectId Project ID for room broadcasting
 * @param taskId The task ID to update (starts with the parent task)
 */
async function updateTaskAncestors(io: any, socket: Socket, projectId: string, taskId: string | null) {
  if (!taskId) return;
  
  try {
    // Get the current task's progress ratio
    const progressRatio = await db.query(
      "SELECT get_task_complete_ratio($1) as ratio",
      [taskId]
    );
    
    const ratio = progressRatio?.rows[0]?.ratio?.ratio || 0;
    console.log(`Updated task ${taskId} progress after time estimation change: ${ratio}`);
    
    // Check if this task needs a "done" status prompt
    let shouldPromptForDone = false;
    
    if (ratio >= 100) {
      // Get the task's current status
      const taskStatusResult = await db.query(`
        SELECT ts.id, stsc.is_done 
        FROM tasks t
        JOIN task_statuses ts ON t.status_id = ts.id
        JOIN sys_task_status_categories stsc ON ts.category_id = stsc.id
        WHERE t.id = $1
      `, [taskId]);
      
      // If the task isn't already in a "done" category, we should prompt the user
      if (taskStatusResult.rows.length > 0 && !taskStatusResult.rows[0].is_done) {
        shouldPromptForDone = true;
      }
    }
    
    // Emit the updated progress
    socket.emit(
      SocketEvents.TASK_PROGRESS_UPDATED.toString(),
      {
        task_id: taskId,
        progress_value: ratio,
        should_prompt_for_done: shouldPromptForDone
      }
    );
    
    // Find this task's parent to continue the recursive update
    const parentResult = await db.query(
      "SELECT parent_task_id FROM tasks WHERE id = $1",
      [taskId]
    );
    
    const parentTaskId = parentResult.rows[0]?.parent_task_id;
    
    // If there's a parent, recursively update it
    if (parentTaskId) {
      await updateTaskAncestors(io, socket, projectId, parentTaskId);
    }
  } catch (error) {
    log_error(`Error updating ancestor task ${taskId}: ${error}`);
  }
}

export async function on_time_estimation_change(io: Server, socket: Socket, data?: string) {
  try {
    // (SELECT SUM(time_spent) FROM task_work_log WHERE task_id = t.id) AS total_minutes_spent,
    const q = `UPDATE tasks SET total_minutes = $2 WHERE id = $1 RETURNING total_minutes, project_id, parent_task_id;`;
    const body = JSON.parse(data as string);

    const hours = body.total_hours || 0;
    const minutes = body.total_minutes || 0;
    const totalMinutes = (hours * 60) + minutes;

    const task_data = await getTaskDetails(body.task_id, "total_minutes");

    const result0 = await db.query(q, [body.task_id, totalMinutes]);
    const [taskData] = result0.rows;
    
    const projectId = taskData.project_id;
    const parentTaskId = taskData.parent_task_id;

    const result = await db.query("SELECT SUM(time_spent) AS total_minutes_spent FROM task_work_log WHERE task_id = $1;", [body.task_id]);
    const [dd] = result.rows;
    const d = {
      id: body.task_id,
      total_minutes: totalMinutes,
      total_hours: hours,
      parent_task: body.parent_task,
      total_minutes_spent: dd.total_minutes_spent || 0
    };
    socket.emit(SocketEvents.TASK_TIME_ESTIMATION_CHANGE.toString(), TasksController.updateTaskViewModel(d));
    
    // If this is a subtask in time-based mode, update parent task progress
    if (parentTaskId) {
      const projectSettingsResult = await db.query(
        "SELECT use_time_progress FROM projects WHERE id = $1",
        [projectId]
      );
      
      const useTimeProgress = projectSettingsResult.rows[0]?.use_time_progress;
      
      if (useTimeProgress) {
        // Recalculate parent task progress when subtask time estimation changes
        await updateTaskAncestors(io, socket, projectId, parentTaskId);
      }
    }
    
    notifyProjectUpdates(socket, d.id);

    logTotalMinutes({
      task_id: body.task_id,
      socket,
      new_value: totalMinutes,
      old_value: task_data.total_minutes
    });
  } catch (error) {
    log_error(error);
  }
}
