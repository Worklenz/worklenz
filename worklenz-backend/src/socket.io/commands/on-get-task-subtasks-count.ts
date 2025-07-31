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
    
    // If there are subtasks, also get their progress information
    if (subtaskCount > 0) {
      // Get all subtasks for this parent task with their progress information
      const subtasksResult = await db.query(`
        SELECT 
          t.id, 
          t.progress_value, 
          t.manual_progress,
          t.weight,
          CASE 
            WHEN t.manual_progress = TRUE THEN t.progress_value
            ELSE COALESCE(
              (SELECT (CASE WHEN tl.total_minutes > 0 THEN 
                (tl.total_minutes_spent / tl.total_minutes * 100) 
              ELSE 0 END)
              FROM (
                SELECT 
                  t2.id, 
                  t2.total_minutes,
                  COALESCE(SUM(twl.time_spent), 0) as total_minutes_spent
                FROM tasks t2
                LEFT JOIN task_work_log twl ON t2.id = twl.task_id
                WHERE t2.id = t.id
                GROUP BY t2.id, t2.total_minutes
              ) tl
            ), 0)
          END as calculated_progress
        FROM tasks t
        WHERE t.parent_task_id = $1 AND t.archived IS FALSE
      `, [taskId]);
      
      // Emit progress updates for each subtask
      for (const subtask of subtasksResult.rows) {
        const progressValue = subtask.manual_progress ? 
          subtask.progress_value : 
          Math.floor(subtask.calculated_progress);
        
        socket.emit(
          SocketEvents.TASK_PROGRESS_UPDATED.toString(),
          {
            task_id: subtask.id,
            progress_value: progressValue,
            weight: subtask.weight
          }
        );
      }
      
      console.log(`Emitted progress updates for ${subtasksResult.rows.length} subtasks of task ${taskId}`);
    }
    
  } catch (error) {
    log_error(`Error getting subtask count for task ${taskId}: ${error}`);
  }
} 