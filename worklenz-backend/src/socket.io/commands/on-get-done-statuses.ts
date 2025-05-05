import { Socket } from "socket.io";
import db from "../../config/db";
import { log_error } from "../util";

// Define a type for the callback function
type DoneStatusesCallback = (statuses: Array<{
  id: string;
  name: string;
  sort_order: number;
  color_code: string;
}>) => void;

/**
 * Socket handler to get task statuses in the "done" category for a project
 * Used when prompting users to mark a task as done when progress reaches 100%
 */
export async function on_get_done_statuses(
  io: any, 
  socket: Socket, 
  projectId: string, 
  callback: DoneStatusesCallback
) {
  try {
    if (!projectId) {
      return callback([]);
    }

    // Query to get all statuses in the "done" category for the project
    const result = await db.query(`
      SELECT ts.id, ts.name, ts.sort_order, stsc.color_code
      FROM task_statuses ts
      INNER JOIN sys_task_status_categories stsc ON ts.category_id = stsc.id
      WHERE ts.project_id = $1
      AND stsc.is_done = TRUE
      ORDER BY ts.sort_order ASC
    `, [projectId]);
    
    const doneStatuses = result.rows;
    
    console.log(`Found ${doneStatuses.length} "done" statuses for project ${projectId}`);
    
    // Use callback to return the result
    callback(doneStatuses);
    
  } catch (error) {
    log_error(`Error getting "done" statuses for project ${projectId}: ${error}`);
    callback([]);
  }
} 