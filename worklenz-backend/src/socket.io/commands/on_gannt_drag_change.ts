import { Server, Socket } from "socket.io";
import { log_error, notifyProjectUpdates } from "../util";
import db from "../../config/db";
import { SocketEvents } from "../events";
import moment from "moment";
import momentTime from "moment-timezone";
import { getTaskDetails, logEndDateChange, logStartDateChange } from "../../services/activity-logs/activity-logs.service";

export async function on_gannt_drag_change(_io: Server, socket: Socket, data?: string) {
  try {
    const body = JSON.parse(data as string);

    const chartStartDate = moment(body.chart_start);

    const taskStartDate = chartStartDate.add(body.from_start, "days");
    const taskEndDate = moment(taskStartDate).add(body.task_duration - 1, "days");

    const task_start_date_data = await getTaskDetails(body.task_id, "start_date");
    const task_end_date_data = await getTaskDetails(body.task_id, "end_date");

    const q = `UPDATE tasks SET start_date = $2, end_date = $3 WHERE id = $1 RETURNING start_date, end_date`;

    const result = await db.query(q, [body.task_id, taskStartDate, taskEndDate]);
    const [d] = result.rows;

    socket.emit(SocketEvents.GANNT_DRAG_CHANGE.toString(), {
      task_id: body.task_id,
      task_width: body.task_width,
      task_offset: body.task_offset,
      start_date: d.start_date,
      end_date: d.end_date,
      group_id: body.group_id
    });

    notifyProjectUpdates(socket, body.task_id);

    logStartDateChange({
      task_id: body.task_id,
      socket,
      new_value: body.time_zone && d.start_date ? momentTime.tz(d.start_date, `${body.time_zone}`) : d.start_date,
      old_value: body.time_zone && task_start_date_data.start_date ? momentTime.tz(task_start_date_data.start_date, `${body.time_zone}`) : task_start_date_data.start_date
    });

    logEndDateChange({
      task_id: body.task_id,
      socket,
      new_value:  body.time_zone && d.end_date ? momentTime.tz(d.end_date, `${body.time_zone}`) : d.end_date,
      old_value:  body.time_zone && task_end_date_data.end_date ? momentTime.tz(task_end_date_data.end_date, `${body.time_zone}`) : task_end_date_data.end_date
    });

  } catch (e) {
    log_error(e);
  }
}
