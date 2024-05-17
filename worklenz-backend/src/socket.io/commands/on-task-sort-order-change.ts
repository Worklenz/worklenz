import {Server, Socket} from "socket.io";
import db from "../../config/db";
import {SocketEvents} from "../events";
import {getLoggedInUserIdFromSocket, log_error, notifyProjectUpdates} from "../util";
import TasksController from "../../controllers/tasks-controller";
import {logPhaseChange, logPriorityChange, logStatusChange} from "../../services/activity-logs/activity-logs.service";
import {GroupBy} from "../../controllers/tasks-controller-base";
import {UNMAPPED} from "../../shared/constants";
import TasksControllerV2 from "../../controllers/tasks-controller-v2";
import { assignMemberIfNot } from "./on-quick-assign-or-remove";

interface ChangeRequest {
  from_index: number; // from sort_order
  to_index: number; // to sort_order
  project_id: string;
  from_group: string;
  to_group: string;
  group_by: string;
  to_last_index: boolean;
  task: {
    id: string;
    project_id: string;
    status: string;
    priority: string;
  };
  team_id: string;
}

interface Config {
  from_index: number;
  to_index: number;
  task_id: string;
  from_group: string | null;
  to_group: string | null;
  project_id: string;
  group_by: string;
  to_last_index: boolean;
}

function notifyStatusChange(socket: Socket, config: Config) {
  const userId = getLoggedInUserIdFromSocket(socket);
  if (userId && config.to_group) {
    void TasksController.notifyStatusChange(userId, config.task_id, config.to_group);
  }
}

async function emitSortOrderChange(data: ChangeRequest, socket: Socket) {
  const q = `
    SELECT id, sort_order
    FROM tasks
    WHERE project_id = $1
    ORDER BY sort_order;
  `;
  const tasks = await db.query(q, [data.project_id]);
  socket.emit(SocketEvents.TASK_SORT_ORDER_CHANGE.toString(), tasks.rows);
}

function updateUnmappedStatus(config: Config) {
  if (config.to_group === UNMAPPED)
    config.to_group = null;
  if (config.from_group === UNMAPPED)
    config.from_group = null;
}

export async function on_task_sort_order_change(_io: Server, socket: Socket, data: ChangeRequest) {
  try {
    const q = `SELECT handle_task_list_sort_order_change($1);`;

    const config: Config = {
      from_index: data.from_index,
      to_index: data.to_index,
      task_id: data.task.id,
      from_group: data.from_group,
      to_group: data.to_group,
      project_id: data.project_id,
      group_by: data.group_by,
      to_last_index: Boolean(data.to_last_index)
    };

    if (config.group_by === GroupBy.STATUS) {
      notifyStatusChange(socket, config);
    }

    if (config.group_by === GroupBy.PHASE) {
      updateUnmappedStatus(config);
    }

    await db.query(q, [JSON.stringify(config)]);
    await emitSortOrderChange(data, socket);

    if (config.group_by === GroupBy.STATUS) {
      const userId = getLoggedInUserIdFromSocket(socket);
      const isAlreadyAssigned = await TasksControllerV2.checkUserAssignedToTask(data.task.id, userId as string, data.team_id);

      if (!isAlreadyAssigned) {
        await assignMemberIfNot(data.task.id, userId as string, data.team_id, _io, socket);
      }
    }

    if (config.group_by === GroupBy.PHASE) {
      void logPhaseChange({
        task_id: data.task.id,
        socket,
        new_value: data.to_group,
        old_value: data.from_group
      });
    }

    if (config.group_by === GroupBy.STATUS) {
      void logStatusChange({
        task_id: data.task.id,
        socket,
        new_value: data.to_group,
        old_value: data.from_group
      });
    }

    if (config.group_by === GroupBy.PRIORITY) {
      void logPriorityChange({
        task_id: data.task.id,
        socket,
        new_value: data.to_group,
        old_value: data.from_group
      });
    }

    void notifyProjectUpdates(socket, config.task_id);
    return;
  } catch (error) {
    log_error(error);
  }

  socket.emit(SocketEvents.TASK_SORT_ORDER_CHANGE.toString(), []);
}
