import { Socket } from "socket.io";
import db from "../../config/db";
import { SocketEvents } from "../events";
import { log, log_error, notifyProjectUpdates } from "../util";
import { logProgressChange } from "../../services/activity-logs/activity-logs.service";

interface UpdateTaskProgressData {
  task_id: string;
  progress_value: number;
  parent_task_id: string | null;
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
    
    const subtaskCount = parseInt(subTasksResult.rows[0]?.subtask_count || '0');
    
    // If this is a parent task, we shouldn't set manual progress
    if (subtaskCount > 0) {
      log_error(`Cannot set manual progress on parent task ${task_id} with ${subtaskCount} subtasks`);
      return;
    }
    
    // Get the current progress value to log the change
    const currentProgressResult = await db.query(
      "SELECT progress_value, project_id FROM tasks WHERE id = $1",
      [task_id]
    );
    
    const currentProgress = currentProgressResult.rows[0]?.progress_value;
    const projectId = currentProgressResult.rows[0]?.project_id;
       
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
      old_value: currentProgress !== null ? currentProgress.toString() : '0',
      new_value: progress_value.toString(),
      socket
    });
    
    if (projectId) {
      // Emit the update to all clients in the project room
      io.to(projectId).emit(
        SocketEvents.TASK_PROGRESS_UPDATED.toString(),
        {
          task_id,
          progress_value
        }
      );
      
      console.log(`Emitted progress update for task ${task_id} to project room ${projectId}`);
      
      // Recursively update all ancestors in the task hierarchy
      await updateTaskAncestors(io, projectId, parent_task_id);
      
      // Notify that project updates are available
      notifyProjectUpdates(socket, task_id);
    }
  } catch (error) {
    log_error(error);
  }
}

/**
 * Recursively updates all ancestor tasks' progress when a subtask changes
 * @param io Socket.io instance
 * @param projectId Project ID for room broadcasting
 * @param taskId The task ID to update (starts with the parent task)
 */
async function updateTaskAncestors(io: any, projectId: string, taskId: string | null) {
  if (!taskId) return;
  
  try {
    // Get the current task's progress ratio
    const progressRatio = await db.query(
      "SELECT get_task_complete_ratio($1) as ratio",
      [taskId]
    );
    
    const ratio = progressRatio?.rows[0]?.ratio;
    console.log(`Updated task ${taskId} progress: ${ratio}`);
    
    // Emit the updated progress
    io.to(projectId).emit(
      SocketEvents.TASK_PROGRESS_UPDATED.toString(),
      {
        task_id: taskId,
        progress_value: ratio
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
      await updateTaskAncestors(io, projectId, parentTaskId);
    }
  } catch (error) {
    log_error(`Error updating ancestor task ${taskId}: ${error}`);
  }
} 