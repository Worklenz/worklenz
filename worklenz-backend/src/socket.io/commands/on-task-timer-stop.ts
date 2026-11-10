import {Server, Socket} from "socket.io";
import {PoolClient} from "pg";
import db from "../../config/db";
import {SocketEvents} from "../events";

import {getLoggedInUserIdFromSocket, log_error, notifyProjectUpdates} from "../util";
import {checkDailyTimeLimit} from "../../services/daily-time-limit.service";
import {DailyTimeEntry} from "../../shared/daily-time-limit";

export async function on_task_timer_stop(_io: Server, socket: Socket, data?: string) {
  let client: PoolClient | null = null;
  try {
    const body = JSON.parse(data as string);
    const userId = getLoggedInUserIdFromSocket(socket);
    
    // Validate inputs
    if (!userId || !body?.task_id || typeof body.task_id !== 'string') {
      socket.emit(SocketEvents.TASK_TIMER_STOP.toString(), null);
      return;
    }
    
    // Validate UUID format (defense in depth - parameterized queries already provide security)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(body.task_id)) {
      socket.emit(SocketEvents.TASK_TIMER_STOP.toString(), null);
      return;
    }
    
    client = await db.pool.connect();
    const transactionClient = client;
    await transactionClient.query("BEGIN");
    
    try {
      if (body.discard === true) {
        // Member chose to discard timer without logging
        await transactionClient.query("DELETE FROM task_timers WHERE user_id = $1 AND task_id = $2;", [userId, body.task_id]);
        await transactionClient.query("COMMIT");
        socket.emit(SocketEvents.TASK_TIMER_STOP.toString(), {
          id: body.task_id,
          task_id: body.task_id,
          parent_task: body.parent_task,
          discarded: true,
        });
        notifyProjectUpdates(socket, body.task_id);
        return;
      }

      // First, lock and get the timer data and calculate time spent
      const timerLookupQuery = `
        SELECT tt.start_time,
               COALESCE(
                 EXTRACT(EPOCH FROM (
                   DATE_TRUNC('second', (CURRENT_TIMESTAMP - tt.start_time::TIMESTAMPTZ))
                 )::INTERVAL),
                 0
               )::int AS time_spent,
               p.team_id
        FROM task_timers tt
        JOIN tasks t ON t.id = tt.task_id
        JOIN projects p ON p.id = t.project_id
        WHERE tt.user_id = $1 AND tt.task_id = $2
        FOR UPDATE;
      `;
      const timerRes = await transactionClient.query(timerLookupQuery, [userId, body.task_id]);
      const timerRow = timerRes.rows[0];

      if (!timerRow) {
        await transactionClient.query("ROLLBACK");
        socket.emit(SocketEvents.TASK_TIMER_STOP.toString(), {
          id: body.task_id,
          task_id: body.task_id,
          parent_task: body.parent_task,
        });
        return;
      }

      const secondsToLog =
        typeof body.override_seconds === "number" && body.override_seconds > 0
          ? Math.floor(body.override_seconds)
          : Math.max(0, timerRow.time_spent);

      if (secondsToLog <= 0) {
        // Zero duration: just delete the timer
        await transactionClient.query("DELETE FROM task_timers WHERE user_id = $1 AND task_id = $2;", [userId, body.task_id]);
        await transactionClient.query("COMMIT");
        socket.emit(SocketEvents.TASK_TIMER_STOP.toString(), {
          id: body.task_id,
          task_id: body.task_id,
          parent_task: body.parent_task,
        });
        notifyProjectUpdates(socket, body.task_id);
        return;
      }

      // Check daily time limit for the timed session
      const additions: DailyTimeEntry[] = [
        {
          start: timerRow.start_time,
          seconds: secondsToLog,
          isTimedSession: true,
        },
      ];

      const check = await checkDailyTimeLimit(
        transactionClient,
        timerRow.team_id,
        userId,
        additions,
        []
      );

      if (!check.allowed) {
        await transactionClient.query("ROLLBACK");
        // Timer is PRESERVED in task_timers! Elapsed time is preserved.
        const remainingHours = Math.floor((check.remainingSeconds || 0) / 3600);
        const remainingMins = Math.round(((check.remainingSeconds || 0) % 3600) / 60);
        const remainingStr = `${remainingHours}h ${remainingMins}m`;

        socket.emit(SocketEvents.TASK_TIMER_STOP.toString(), {
          id: body.task_id,
          task_id: body.task_id,
          parent_task: body.parent_task,
          over_limit: true,
          elapsed_seconds: timerRow.time_spent,
          start_time: timerRow.start_time,
          remaining_seconds: check.remainingSeconds || 0,
          exceeded_day: check.exceededDay,
          message: `Daily time limit of 24 hours exceeded for ${check.exceededDay}. You have ${remainingStr} remaining.`,
        });
        return;
      }

      // Insert work log
      const insertQuery = `
        INSERT INTO task_work_log (time_spent, task_id, user_id, logged_by_timer, created_at)
        VALUES ($1, $2, $3, TRUE, $4);
      `;
      await transactionClient.query(insertQuery, [secondsToLog, body.task_id, userId, timerRow.start_time]);

      // Delete the timer
      const deleteQuery = `DELETE FROM task_timers WHERE user_id = $1 AND task_id = $2;`;
      await transactionClient.query(deleteQuery, [userId, body.task_id]);
      
      await transactionClient.query("COMMIT");

      // Notify team members of time log update
      const membersQuery = `
        SELECT DISTINCT u.socket_id
        FROM team_members tm
        INNER JOIN users u ON tm.user_id = u.id
        WHERE tm.team_id = $1
          AND u.socket_id IS NOT NULL;
      `;
      const membersResult = await db.query(membersQuery, [timerRow.team_id]);
      for (const member of membersResult.rows) {
        socket.to(member.socket_id).emit(SocketEvents.TASK_TIME_LOG_UPDATED.toString(), { task_id: body.task_id });
      }
    } catch (error) {
      await transactionClient.query("ROLLBACK");
      throw error;
    }

    socket.emit(SocketEvents.TASK_TIMER_STOP.toString(), {
      id: body.task_id,
      task_id: body.task_id,
      parent_task: body.parent_task,
    });
    notifyProjectUpdates(socket, body.task_id);
    return;
  } catch (error) {
    log_error(error);
  } finally {
    client?.release();
  }

  socket.emit(SocketEvents.TASK_TIMER_STOP.toString(), null);
}
