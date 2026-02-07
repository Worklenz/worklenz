import {Server, Socket} from "socket.io";
import db from "../../config/db";
import {SocketEvents} from "../events";

import {getLoggedInUserIdFromSocket, log_error, notifyProjectUpdates} from "../util";

export async function on_task_timer_stop(_io: Server, socket: Socket, data?: string) {
  try {
    const body = JSON.parse(data as string);
    const userId = getLoggedInUserIdFromSocket(socket);
    
    // Validate inputs
    if (!body.task_id || typeof body.task_id !== 'string') {
      socket.emit(SocketEvents.TASK_TIMER_STOP.toString(), null);
      return;
    }
    
    // Validate UUID format (defense in depth - parameterized queries already provide security)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(body.task_id)) {
      socket.emit(SocketEvents.TASK_TIMER_STOP.toString(), null);
      return;
    }
    
    await db.query("BEGIN");
    
    try {
      // First, get the timer data and calculate time spent
      const timerQuery = `
        WITH timer_data AS (
          SELECT start_time 
          FROM task_timers 
          WHERE user_id = $1 AND task_id = $2
        ),
        time_calculation AS (
          SELECT 
            COALESCE(
              EXTRACT(EPOCH FROM (
                DATE_TRUNC('second', (CURRENT_TIMESTAMP - timer_data.start_time::TIMESTAMPTZ))
              )::INTERVAL),
              0
            ) as time_spent,
            timer_data.start_time
          FROM timer_data
        )
        INSERT INTO task_work_log (time_spent, task_id, user_id, logged_by_timer, created_at)
        SELECT time_spent, $2, $1, TRUE, start_time
        FROM time_calculation
        WHERE time_spent > 0;
      `;
      await db.query(timerQuery, [userId, body.task_id]);
      
      // Then, delete the timer
      const deleteQuery = `DELETE FROM task_timers WHERE user_id = $1 AND task_id = $2;`;
      await db.query(deleteQuery, [userId, body.task_id]);
      
      await db.query("COMMIT");
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    }

    socket.emit(SocketEvents.TASK_TIMER_STOP.toString(), {
      id: body.task_id,
      parent_task: body.parent_task,
    });
    notifyProjectUpdates(socket, body.task_id);
    return;
  } catch (error) {
    log_error(error);
  }

  socket.emit(SocketEvents.TASK_TIMER_STOP.toString(), null);
}
