import { Socket } from "socket.io";
import db from "../../config/db";
import { SocketEvents } from "../events";
import { log_error } from "../util";

/**
 * Socket handler to retrieve the number of subtasks for a given task
 * Used to validate on the client side whether a task should show progress inputs
 */
export async function on_get_task_subtasks_count(io: any, socket: Socket, taskId: string) {
  try {
    if (!taskId) {
      return;
    }

    // Get the count of subtasks for this task
    const result = await db.query(
      "SELECT COUNT(*) as subtask_count FROM tasks WHERE parent_task_id = $1 AND archived IS FALSE",
      [taskId]
    );
    
    const subtaskCount = parseInt(result.rows[0]?.subtask_count || "0");
    
    // Emit the subtask count back to the client
    socket.emit(
      "TASK_SUBTASKS_COUNT",
      {
        task_id: taskId,
        subtask_count: subtaskCount,
        has_subtasks: subtaskCount > 0
      }
    );
    
    console.log(`Emitted subtask count for task ${taskId}: ${subtaskCount}`);
    
  } catch (error) {
    log_error(`Error getting subtask count for task ${taskId}: ${error}`);
  }
} 