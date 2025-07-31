import {Server, Socket} from "socket.io";
import {SocketEvents} from "../events";
import {log_error} from "../util";
import TasksControllerV2 from "../../controllers/tasks-controller-v2";

export async function on_get_task_progress(_io: Server, socket: Socket, taskId?: string) {
  try {
    console.log(`GET_TASK_PROGRESS requested for task: ${taskId}`);
    
    const task: any = {};
    task.id = taskId;

    const info = await TasksControllerV2.getTaskCompleteRatio(task.parent_task_id || task.id);
    if (info) {
      task.complete_ratio = info.ratio;
      task.completed_count = info.total_completed;
      task.total_tasks_count = info.total_tasks;
      
      console.log(`Sending task progress for task ${taskId}: complete_ratio=${task.complete_ratio}`);
    }

    return socket.emit(SocketEvents.GET_TASK_PROGRESS.toString(), task);
  } catch (error) {
    log_error(error);
  }

  socket.emit(SocketEvents.GET_TASK_PROGRESS.toString(), null);
}
