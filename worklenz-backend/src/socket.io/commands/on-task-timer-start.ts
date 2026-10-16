import moment from "moment";
import momentTime from "moment-timezone";
import {Server, Socket} from "socket.io";
import db from "../../config/db";
import {SocketEvents} from "../events";

import {getLoggedInUserIdFromSocket, log_error, notifyProjectUpdates} from "../util";

export async function on_task_timer_start(_io: Server, socket: Socket, data?: string) {
  try {
    const body = JSON.parse(data as string);
    const userId = getLoggedInUserIdFromSocket(socket);

    if (!userId) {
      socket.emit(SocketEvents.TASK_TIMER_START.toString(), null);
      return;
    }

    if (!body?.task_id) {
      socket.emit(SocketEvents.TASK_TIMER_START.toString(), null);
      return;
    }

    // Check if task's project has a start date in the future
    const projectCheck = await db.query(
      `SELECT p.start_date,
              COALESCE((SELECT tz.name FROM timezones tz WHERE tz.id = u.timezone_id), 'UTC') AS timezone
       FROM tasks t
       INNER JOIN projects p ON p.id = t.project_id
       LEFT JOIN users u ON u.id = $2
       WHERE t.id = $1::uuid
       LIMIT 1;`,
      [body.task_id, userId]
    );
    const projectRow = projectCheck.rows[0];
    if (projectRow?.start_date) {
      const timezone = projectRow.timezone || "UTC";
      const projectStartDay = momentTime.tz(projectRow.start_date, timezone).startOf("day");
      const today = momentTime.tz(timezone).startOf("day");
      if (today.isBefore(projectStartDay)) {
        const errorMsg = `Time cannot be logged before the project start date (${projectStartDay.format("MMM DD, YYYY")}).`;
        // Project has not started yet — timer cannot run
        socket.emit(SocketEvents.TASK_TIMER_STOP.toString(), {
          id: body.task_id,
          task_id: body.task_id,
          parent_task: body.parent_task,
        });
        socket.emit("timer-error", {
          id: body.task_id,
          task_id: body.task_id,
          error: errorMsg,
          message: errorMsg,
        });
        return;
      }
    }

    const q = `
    INSERT INTO task_timers (task_id, user_id, start_time)
    VALUES ($1, $2, CURRENT_TIMESTAMP)
    ON CONFLICT ON CONSTRAINT task_timers_pk DO UPDATE SET start_time = CURRENT_TIMESTAMP
    RETURNING start_time;
    `;

    const result = await db.query(q, [body.task_id, userId]);
    const [d] = result.rows;
    socket.emit(SocketEvents.TASK_TIMER_START.toString(), {
      id: body.task_id,
      timer_start_time: moment(d.start_time).valueOf(),
      parent_task: body.parent_task,
    });
    notifyProjectUpdates(socket, body.task_id);
    return;
  } catch (error) {
    log_error(error);
  }

  socket.emit(SocketEvents.TASK_TIMER_START.toString(), null);
}
