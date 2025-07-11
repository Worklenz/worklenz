import { Socket } from "socket.io";
import db from "../../config/db";
import { SocketEvents } from "../events";
import { log, log_error, notifyProjectUpdates } from "../util";
import { logWeightChange } from "../../services/activity-logs/activity-logs.service";
import TasksControllerV2 from "../../controllers/tasks-controller-v2";

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
    
    // Update the task weight using our controller method
    await TasksControllerV2.updateTaskWeight(task_id, weight);
    
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
        // Use the controller to update the parent task progress
        await TasksControllerV2.updateTaskProgress(parent_task_id);
        
        // Get the updated progress to emit to clients
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
        
        // We also need to update any grandparent tasks
        const grandparentResult = await db.query(
          "SELECT parent_task_id FROM tasks WHERE id = $1",
          [parent_task_id]
        );
        
        const grandparentId = grandparentResult.rows[0]?.parent_task_id;
        
        if (grandparentId) {
          await TasksControllerV2.updateTaskProgress(grandparentId);
          
          // Emit the grandparent's updated progress
          const grandparentProgressRatio = await db.query(
            "SELECT get_task_complete_ratio($1) as ratio",
            [grandparentId]
          );
          
          socket.emit(
            SocketEvents.TASK_PROGRESS_UPDATED.toString(),
            {
              task_id: grandparentId,
              progress_value: grandparentProgressRatio?.rows[0]?.ratio?.ratio || 0
            }
          );
        }
      }
      
      // Notify that project updates are available
      notifyProjectUpdates(socket, task_id);
    }
  } catch (error) {
    log_error(error);
  }
} 