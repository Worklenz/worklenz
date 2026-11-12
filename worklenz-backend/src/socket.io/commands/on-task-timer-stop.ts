import {Server, Socket} from "socket.io";
import {PoolClient} from "pg";
import db from "../../config/db";
import {SocketEvents} from "../events";

import {getLoggedInUserIdFromSocket, log_error, notifyProjectUpdates, emitToTaskVisibleProjectMembers} from "../util";
import {checkDailyTimeLimit} from "../../services/daily-time-limit.service";
import {DailyTimeEntry} from "../../shared/daily-time-limit";
import moment from "moment-timezone";

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
               p.team_id, t.project_id
        FROM task_timers tt
        JOIN tasks t ON t.id = tt.task_id
        JOIN projects p ON p.id = t.project_id
        WHERE tt.user_id = $1 AND tt.task_id = $2
        FOR UPDATE OF tt;
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

      if (body.override_seconds !== undefined &&
          (typeof body.override_seconds !== "number" || !Number.isFinite(body.override_seconds) ||
           body.override_seconds < 1 || body.override_seconds > timerRow.time_spent)) {
        await transactionClient.query("ROLLBACK");
        socket.emit(SocketEvents.TASK_TIMER_STOP.toString(), null);
        return;
      }

      const secondsToLog =
        typeof body.override_seconds === "number" && body.override_seconds > 0
          ? Math.floor(body.override_seconds)
          : Math.max(0, timerRow.time_spent);

      let logStart = timerRow.start_time;
      if (body.override_seconds !== undefined) {
        const timezoneResult = await transactionClient.query(
          `SELECT COALESCE(tz.name, 'UTC') AS timezone FROM users u
           LEFT JOIN timezones tz ON tz.id = u.timezone_id WHERE u.id = $1`, [userId]
        );
        const timezone = timezoneResult.rows[0]?.timezone;
        const day = typeof body.override_day === "string" && moment.tz.zone(timezone)
          ? moment.tz(body.override_day, "YYYY-MM-DD", true, timezone) : null;
        const start = moment(timerRow.start_time);
        const end = start.clone().add(timerRow.time_spent, "seconds");
        if (!day?.isValid()) {
          await transactionClient.query("ROLLBACK");
          socket.emit(SocketEvents.TASK_TIMER_STOP.toString(), null);
          return;
        }
        const intervalStart = moment.max(start, day.clone().startOf("day"));
        const intervalEnd = moment.min(end, day.clone().add(1, "day").startOf("day"));
        if (intervalEnd.diff(intervalStart, "seconds") < secondsToLog) {
          await transactionClient.query("ROLLBACK");
          socket.emit(SocketEvents.TASK_TIMER_STOP.toString(), null);
          return;
        }
        logStart = intervalStart.toDate();
      }

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
          start: logStart,
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
        const exceededDay = check.exceededDay && check.timezone
          ? moment.tz(check.exceededDay, "YYYY-MM-DD", true, check.timezone) : null;
        const timerStart = moment(timerRow.start_time);
        const timerEnd = timerStart.clone().add(timerRow.time_spent, "seconds");
        const recoverableSeconds = exceededDay?.isValid()
          ? Math.max(0, moment.min(timerEnd, exceededDay.clone().add(1, "day").startOf("day"))
            .diff(moment.max(timerStart, exceededDay.clone().startOf("day")), "seconds")) : 0;
        const remaining = Math.min(check.remainingSeconds || 0, recoverableSeconds);
        const remainingHours = Math.floor(remaining / 3600);
        const remainingMins = Math.round((remaining % 3600) / 60);
        const remainingStr = `${remainingHours}h ${remainingMins}m`;

        socket.emit(SocketEvents.TASK_TIMER_STOP.toString(), {
          id: body.task_id,
          task_id: body.task_id,
          parent_task: body.parent_task,
          over_limit: true,
          elapsed_seconds: timerRow.time_spent,
          start_time: timerRow.start_time,
          remaining_seconds: remaining,
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
      await transactionClient.query(insertQuery, [secondsToLog, body.task_id, userId, logStart]);

      // Delete the timer
      const deleteQuery = `DELETE FROM task_timers WHERE user_id = $1 AND task_id = $2;`;
      await transactionClient.query(deleteQuery, [userId, body.task_id]);
      
      await transactionClient.query("COMMIT");
      transactionClient.release();
      client = null;
      // Notifications are best effort and cannot undo the committed stop.
      void emitToTaskVisibleProjectMembers(socket, timerRow.project_id, body.task_id,
        SocketEvents.TASK_TIME_LOG_UPDATED.toString(), { task_id: body.task_id }, { excludeSocketId: socket.id });
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
