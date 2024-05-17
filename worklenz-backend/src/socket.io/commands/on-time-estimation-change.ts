import { Server, Socket } from "socket.io";
import db from "../../config/db";
import TasksController from "../../controllers/tasks-controller";
import { SocketEvents } from "../events";

import { log_error, notifyProjectUpdates } from "../util";
import { getTaskDetails, logTotalMinutes } from "../../services/activity-logs/activity-logs.service";

export async function on_time_estimation_change(_io: Server, socket: Socket, data?: string) {
  try {
    // (SELECT SUM(time_spent) FROM task_work_log WHERE task_id = t.id) AS total_minutes_spent,
    const q = `UPDATE tasks SET total_minutes = $2 WHERE id = $1 RETURNING total_minutes;`;
    const body = JSON.parse(data as string);

    const hours = body.total_hours || 0;
    const minutes = body.total_minutes || 0;
    const totalMinutes = (hours * 60) + minutes;

    const task_data = await getTaskDetails(body.task_id, "total_minutes");

    const result0 = await db.query(q, [body.task_id, totalMinutes]);
    const [data0] = result0.rows;

    const result = await db.query("SELECT SUM(time_spent) AS total_minutes_spent FROM task_work_log WHERE task_id = $1;", [body.task_id]);
    const [dd] = result.rows;
    const d = {
      id: body.task_id,
      total_minutes: totalMinutes,
      total_hours: hours,
      parent_task: body.parent_task,
      total_minutes_spent: dd.total_minutes_spent || 0
    };
    socket.emit(SocketEvents.TASK_TIME_ESTIMATION_CHANGE.toString(), TasksController.updateTaskViewModel(d));
    notifyProjectUpdates(socket, d.id);

    logTotalMinutes({
      task_id: body.task_id,
      socket,
      new_value: totalMinutes,
      old_value: task_data.total_minutes
    });
  } catch (error) {
    log_error(error);
  }
}
