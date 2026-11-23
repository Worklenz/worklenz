import { Server, Socket } from "socket.io";
import { SocketEvents } from "../events";
import { getLoggedInUserIdFromSocket, log_error } from "../util";
import { verifyTaskAccessSocket, logUnauthorizedSocketAccess } from "../authorization";
import TasksControllerV2 from "../../controllers/tasks-controller-v2";

export async function on_get_task_progress(_io: Server, socket: Socket, taskId?: string) {
  try {
    if (!taskId || typeof taskId !== "string") {
      return socket.emit(SocketEvents.GET_TASK_PROGRESS.toString(), null);
    }

    const userId = getLoggedInUserIdFromSocket(socket);
    if (!userId) {
      logUnauthorizedSocketAccess(socket, "GET_TASK_PROGRESS", "task", taskId);
      return socket.emit(SocketEvents.GET_TASK_PROGRESS.toString(), null);
    }

    const hasAccess = await verifyTaskAccessSocket(socket, taskId);
    if (!hasAccess) {
      logUnauthorizedSocketAccess(socket, "GET_TASK_PROGRESS", "task", taskId);
      return socket.emit(SocketEvents.GET_TASK_PROGRESS.toString(), null);
    }

    const task: any = {};
    task.id = taskId;

    const info = await TasksControllerV2.getTaskCompleteRatio(task.parent_task_id || task.id);
    if (info) {
      task.complete_ratio = info.ratio;
      task.completed_count = info.total_completed;
      task.total_tasks_count = info.total_tasks;
    }

    return socket.emit(SocketEvents.GET_TASK_PROGRESS.toString(), task);
  } catch (error) {
    log_error(error);
  }

  socket.emit(SocketEvents.GET_TASK_PROGRESS.toString(), null);
}
