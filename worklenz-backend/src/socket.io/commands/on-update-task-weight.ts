import { Socket } from "socket.io";
import db from "../../config/db";
import { SocketEvents } from "../events";
import { log, log_error, notifyProjectUpdates } from "../util";
import { logWeightChange } from "../../services/activity-logs/activity-logs.service";

interface UpdateTaskWeightData {
  task_id: string;
  weight: number;
  parent_task_id: string | null;
}

export async function on_update_task_weight(io: any, socket: Socket, data: string) {
  try {
    
    const parsedData = JSON.parse(data) as UpdateTaskWeightData;
    const { task_id, weight, parent_task_id } = parsedData;
    
    if (!task_id || weight === undefined) {
      return;
    }
    
    // Get the current weight value to log the change
    const currentWeightResult = await db.query(
      "SELECT weight, project_id FROM tasks WHERE id = $1",
      [task_id]
    );
    
    const currentWeight = currentWeightResult.rows[0]?.weight;
    const projectId = currentWeightResult.rows[0]?.project_id;
    
    // Update the task weight in the database
    await db.query(
      `UPDATE tasks 
      SET weight = $1, updated_at = NOW() 
      WHERE id = $2`,
      [weight, task_id]
    );
    
    // Log the weight change using the activity logs service
    await logWeightChange({
      task_id,
      old_value: currentWeight !== null ? currentWeight.toString() : "100",
      new_value: weight.toString(),
      socket
    });
    
    if (projectId) {
      // Emit the update to all clients in the project room
      socket.emit(
        SocketEvents.TASK_PROGRESS_UPDATED.toString(),
        {
          task_id,
          weight
        }
      );
      
      // If this is a subtask, update the parent task's progress
      if (parent_task_id) {
        const progressRatio = await db.query(
          "SELECT get_task_complete_ratio($1) as ratio",
          [parent_task_id]
        );
        
        // Emit the parent task's updated progress
        socket.emit(
          SocketEvents.TASK_PROGRESS_UPDATED.toString(),
          {
            task_id: parent_task_id,
            progress_value: progressRatio?.rows[0]?.ratio?.ratio || 0
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