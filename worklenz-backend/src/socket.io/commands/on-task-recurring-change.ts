import { Server, Socket } from "socket.io";
import { log_error } from "../util";
import { SocketEvents } from "../events";
import TasksRecurringController from "../../controllers/task-recurring-controller";

export async function on_task_recurring_change(_io: Server, socket: Socket, data?: { task_id?: string, schedule_id?: string }) {
    if (!data?.task_id) return;
    try {
        if (!data.schedule_id) {
            const scheduleData = await TasksRecurringController.createTaskSchedule(data.task_id);

            socket.emit(SocketEvents.TASK_RECURRING_CHANGE.toString(), {
                task_id: data?.task_id,
                id: scheduleData.id,
                schedule_type: scheduleData.schedule_type
            });
        } else {
            await TasksRecurringController.removeTaskSchedule(data.schedule_id);
            socket.emit(SocketEvents.TASK_RECURRING_CHANGE.toString(), {
                task_id: data?.task_id,
                id: null,
                schedule_type: null
            });
        }

    } catch (e) {
        log_error(e);
    }
}