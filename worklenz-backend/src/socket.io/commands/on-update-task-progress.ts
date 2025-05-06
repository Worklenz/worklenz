import { Socket } from "socket.io";
import db from "../../config/db";
import { SocketEvents } from "../events";
import { log, log_error, notifyProjectUpdates } from "../util";
import { logProgressChange } from "../../services/activity-logs/activity-logs.service";
import TasksControllerV2 from "../../controllers/tasks-controller-v2";

interface UpdateTaskProgressData {
  task_id: string;
  progress_value: number;
  parent_task_id: string | null;
}

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
    // Use the new controller method to update the task progress
    await TasksControllerV2.updateTaskProgress(taskId);
    
    // Get the current task's progress ratio
    const progressRatio = await db.query(
      "SELECT get_task_complete_ratio($1) as ratio",
      [taskId]
    );
    
    const ratio = progressRatio?.rows[0]?.ratio?.ratio || 0;
    console.log(`Updated task ${taskId} progress: ${ratio}`);
    
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

export async function on_update_task_progress(io: any, socket: Socket, data: string) {
  try {   
    const parsedData = JSON.parse(data) as UpdateTaskProgressData;
    const { task_id, progress_value, parent_task_id } = parsedData;    
    
    if (!task_id || progress_value === undefined) {
      return;
    }
    
    // Check if this is a parent task (has subtasks)
    const subTasksResult = await db.query(
      "SELECT COUNT(*) as subtask_count FROM tasks WHERE parent_task_id = $1",
      [task_id]
    );
    
    const subtaskCount = parseInt(subTasksResult.rows[0]?.subtask_count || "0");
    
    // If this is a parent task, we shouldn't set manual progress
    if (subtaskCount > 0) {
      log_error(`Cannot set manual progress on parent task ${task_id} with ${subtaskCount} subtasks`);
      return;
    }
    
    // Get the current progress value to log the change
    const currentProgressResult = await db.query(
      "SELECT progress_value, project_id, status_id FROM tasks WHERE id = $1",
      [task_id]
    );
    
    const currentProgress = currentProgressResult.rows[0]?.progress_value;
    const projectId = currentProgressResult.rows[0]?.project_id;
    const statusId = currentProgressResult.rows[0]?.status_id;
       
    // Update the task progress in the database
    await db.query(
      `UPDATE tasks 
      SET progress_value = $1, manual_progress = true, updated_at = NOW() 
      WHERE id = $2`,
      [progress_value, task_id]
    );
    
    // Log the progress change using the activity logs service
    await logProgressChange({
      task_id,
      old_value: currentProgress !== null ? currentProgress.toString() : "0",
      new_value: progress_value.toString(),
      socket
    });
    
    if (projectId) {
      // Check if progress is 100% and the task isn't already in a "done" status category
      let shouldPromptForDone = false;
      
      if (progress_value >= 100) {
        // Check if the task's current status is in a "done" category
        const statusCategoryResult = await db.query(`
          SELECT stsc.is_done 
          FROM task_statuses ts
          JOIN sys_task_status_categories stsc ON ts.category_id = stsc.id
          WHERE ts.id = $1
        `, [statusId]);
        
        // If the task isn't already in a "done" category, we should prompt the user
        if (statusCategoryResult.rows.length > 0 && !statusCategoryResult.rows[0].is_done) {
          shouldPromptForDone = true;
        }
      }

      // Emit the update to all clients in the project room
      socket.emit(
        SocketEvents.TASK_PROGRESS_UPDATED.toString(),
        {
          task_id,
          progress_value,
          should_prompt_for_done: shouldPromptForDone
        }
      );
      
      log(`Emitted progress update for task ${task_id} to project room ${projectId}`, null);
      
      // If this task has a parent, use our controller to update all ancestors
      if (parent_task_id) {
        // Use the controller method to update the parent task's progress
        await TasksControllerV2.updateTaskProgress(parent_task_id);
        // Also use the existing method for socket notifications
        await updateTaskAncestors(io, socket, projectId, parent_task_id);
      }
      
      // Notify that project updates are available
      notifyProjectUpdates(socket, task_id);
    }
  } catch (error) {
    log_error(error);
  }
}
