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
    log(socket.id, `${SocketEvents.UPDATE_TASK_PROGRESS}: ${data}`);
    
    const parsedData = JSON.parse(data) as UpdateTaskProgressData;
    const { task_id, progress_value, parent_task_id } = parsedData;
    
    console.log(`Updating progress for task ${task_id}: new value = ${progress_value}`);
    
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
      console.log(`Cannot set manual progress on parent task ${task_id} with ${subtaskCount} subtasks`);
      return;
    }
    
    // Get the current progress value to log the change
    const currentProgressResult = await db.query(
      "SELECT progress_value, project_id, team_id FROM tasks WHERE id = $1",
      [task_id]
    );
    
    const currentProgress = currentProgressResult.rows[0]?.progress_value;
    const projectId = currentProgressResult.rows[0]?.project_id;
    const teamId = currentProgressResult.rows[0]?.team_id;
    
    console.log(`Previous progress for task ${task_id}: ${currentProgress}; New: ${progress_value}`);
    
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
      
      // If this is a subtask, update the parent task's progress
      if (parent_task_id) {
        const progressRatio = await db.query(
          "SELECT get_task_complete_ratio($1) as ratio",
          [parent_task_id]
        );
        
        console.log(`Updated parent task ${parent_task_id} progress: ${progressRatio?.rows[0]?.ratio}`);
        
        // Emit the parent task's updated progress
        io.to(projectId).emit(
          SocketEvents.TASK_PROGRESS_UPDATED.toString(),
          {
            task_id: parent_task_id,
            progress_value: progressRatio?.rows[0]?.ratio
          }
        );
      }
      
      // Notify that project updates are available
      notifyProjectUpdates(socket, task_id);
    }
  } catch (error) {
    log_error(error);
  }
} 