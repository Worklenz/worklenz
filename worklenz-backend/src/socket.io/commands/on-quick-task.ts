import {Server, Socket} from "socket.io";
import db from "../../config/db";
import {getColor, toMinutes} from "../../shared/utils";
import {SocketEvents} from "../events";

import {log_error, notifyProjectUpdates} from "../util";
import TasksControllerV2 from "../../controllers/tasks-controller-v2";
import {TASK_STATUS_COLOR_ALPHA, UNMAPPED} from "../../shared/constants";
import moment from "moment";
import momentTime from "moment-timezone";
import { logEndDateChange, logStartDateChange, logStatusChange } from "../../services/activity-logs/activity-logs.service";

export async function getTaskCompleteInfo(task: any) {
  if (!task) return null;

  const q2 = "SELECT get_task_complete_info($1, $2) AS res;";
  const result2 = await db.query(q2, [task.id, null]);
  const [d2] = result2.rows;

  task.completed_count = d2.res.total_completed || 0;
  if (task.sub_tasks_count > 0)
    task.sub_tasks_count = d2.res.total_tasks;
  return task;
}

async function updateCompleteInfo(data: any, model: any) {
  const info = await TasksControllerV2.getTaskCompleteRatio(data.task.parent_task_id || data.task.id);
  if (info) {
    model.complete_ratio = info.ratio;
    model.completed_count = info.total_completed;
    model.total_tasks_count = info.total_tasks;
  }
}

function updatePhaseInfo(model: any, body: any) {
  model.phase_id = body.phase_id;

  // if (model.phase_name) {
  //   model.phase_color = model.phase_color;
  // }
}

function createGaantTask(body: any) {
  const fromStart = Math.floor(body.offset) / 35;
  const duration = Math.floor(body.width) / 35;
  const chartStartDate = moment(body.chart_start);

  body.start_date = chartStartDate.add(fromStart, "days").format("YYYY-MM-DD").trim();
  body.end_date = moment(body.start_date).add(duration - 1, "days").format("YYYY-MM-DD").trim();

  return body;
}

export async function on_quick_task(_io: Server, socket: Socket, data?: string) {
  try {
    const q = `SELECT create_quick_task($1) AS task;`;
    const body = JSON.parse(data as string);



    body.name = (body.name || "").trim();
    body.priority_id = body.priority_id?.trim() || null;
    body.status_id = body.status_id?.trim() || null;
    body.phase_id = body.phase_id?.trim() || null;
    body.end_date = body.end_date?.trim() || null;

    if (body.priority_id === UNMAPPED) body.priority_id = null;
    if (body.phase_id === UNMAPPED) body.phase_id = null;
    if (body.status_id === UNMAPPED) body.status_id = null;

    if (body.is_dragged) createGaantTask(body);

    if (body.name.length > 0) {
      body.total_minutes = toMinutes(body.total_hours, body.total_minutes);
      const result = await db.query(q, [JSON.stringify(body)]);
      const [d] = result.rows;
      if (d.task) {

        if (body.chart_start) {
          d.task.chart_start = moment(body.chart_start).format("YYYY-MM-DD");
        }

        const model = TasksControllerV2.updateTaskViewModel(d.task);

        await updateCompleteInfo(d, model);

        updatePhaseInfo(model, body);

        socket.emit(SocketEvents.QUICK_TASK.toString(), model);

        if (body.is_dragged) {
          logStartDateChange({
            task_id: d.task.id,
            socket,
            new_value: body.time_zone && d.task.start_date ? momentTime.tz(d.task.start_date, `${body.time_zone}`) : d.task.start_date,
            old_value: null
          });

          logEndDateChange({
            task_id: d.task.id,
            socket,
            new_value:  body.time_zone && d.task.end_date ? momentTime.tz(d.task.end_date, `${body.time_zone}`) : d.task.end_date,
            old_value:  null
          });
        }

        logStatusChange({
          task_id: d.task.id,
          socket,
          new_value: d.task.status,
          old_value: null
        });

        notifyProjectUpdates(socket, d.task.id);
      }
    } else {
      // Empty task name, emit null to indicate no task was created
      socket.emit(SocketEvents.QUICK_TASK.toString(), null);
    }
  } catch (error) {
    log_error(error);
    socket.emit(SocketEvents.QUICK_TASK.toString(), null);
  }
}
