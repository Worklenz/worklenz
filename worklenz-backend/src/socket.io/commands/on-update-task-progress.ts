import { Socket } from "socket.io";
import db from "../../config/db";
import { SocketEvents } from "../events";
import { log, log_error, notifyProjectUpdates } from "../util";

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
    
    if (!task_id || progress_value === undefined) {
      return;
    }
    
    // Update the task progress in the database
    await db.query(
      `UPDATE tasks 
      SET progress_value = $1, manual_progress = true, updated_at = NOW() 
      WHERE id = $2`,
      [progress_value, task_id]
    );
    
    // Get the project ID for the task
    const projectResult = await db.query("SELECT project_id FROM tasks WHERE id = $1", [task_id]);
    const projectId = projectResult.rows[0]?.project_id;
    
    if (projectId) {
      // Emit the update to all clients in the project room
      io.to(projectId).emit(
        SocketEvents.TASK_PROGRESS_UPDATED.toString(),
        {
          task_id,
          progress_value
        }
      );
      
      // If this is a subtask, update the parent task's progress
      if (parent_task_id) {
        const progressRatio = await db.query(
          "SELECT get_task_complete_ratio($1) as ratio",
          [parent_task_id]
        );
        
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