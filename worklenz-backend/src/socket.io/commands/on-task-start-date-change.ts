import {Server, Socket} from "socket.io";
import db from "../../config/db";
import {SocketEvents} from "../events";

import {log_error, notifyProjectUpdates} from "../util";
import {getTaskDetails, logStartDateChange} from "../../services/activity-logs/activity-logs.service";
import momentTime from "moment-timezone";

export async function on_task_start_date_change(_io: Server, socket: Socket, data?: string) {
  try {
    const q = `UPDATE tasks
               SET start_date = $2
               WHERE id = $1
               RETURNING start_date, end_date;`;
    const body = JSON.parse(data as string);
    const task_data = await getTaskDetails(body.task_id, "start_date");
    const result = await db.query(q, [body.task_id, body.start_date]);

    const [d] = result.rows;
    socket.emit(SocketEvents.TASK_START_DATE_CHANGE.toString(), {
      id: body.task_id,
      start_date: d.start_date,
      parent_task: body.parent_task,
      end_date: d.end_date,
      group_id: body.group_id
    });

    notifyProjectUpdates(socket, body.task_id);

    logStartDateChange({
      task_id: body.task_id,
      socket,
      new_value: body.time_zone && d.start_date ? momentTime.tz(d.start_date, `${body.time_zone}`) : d.start_date,
      old_value: body.time_zone && task_data.start_date ? momentTime.tz(task_data.start_date, `${body.time_zone}`) : task_data.start_date
    });

    return;
  } catch (error) {
    log_error(error);
  }

  socket.emit(SocketEvents.TASK_START_DATE_CHANGE.toString(), null);
}
