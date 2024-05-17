import {Server, Socket} from "socket.io";
import db from "../../config/db";
import {SocketEvents} from "../events";

import {log_error, notifyProjectUpdates} from "../util";
import {getTaskDetails, logEndDateChange} from "../../services/activity-logs/activity-logs.service";
import momentTime from "moment-timezone";

export async function on_task_end_date_change(_io: Server, socket: Socket, data?: string) {
  try {
    const q = `UPDATE tasks SET end_date = $2 WHERE id = $1 RETURNING end_date, start_date;`;
    const body = JSON.parse(data as string);
    const task_data = await getTaskDetails(body.task_id, "end_date");

    const result = await db.query(q, [body.task_id, body.end_date]);
    const [d] = result.rows;
    socket.emit(SocketEvents.TASK_END_DATE_CHANGE.toString(), {
      id: body.task_id,
      parent_task: body.parent_task,
      end_date: d.end_date,
      start_date: d.start_date,
      group_id: body.group_id
    });

    notifyProjectUpdates(socket, body.task_id);
    logEndDateChange({
      task_id: body.task_id,
      socket,
      new_value: body.time_zone && d.end_date ? momentTime.tz(d.end_date, `${body.time_zone}`) : d.end_date,
      old_value: body.time_zone && task_data.end_date ? momentTime.tz(task_data.end_date, `${body.time_zone}`) : task_data.end_date
    });

    return;
  } catch (error) {
    log_error(error);
  }

  socket.emit(SocketEvents.TASK_END_DATE_CHANGE.toString(), null);
}
