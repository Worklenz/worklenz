import { Socket } from "socket.io";
import db from "../../config/db";
import { SocketEvents } from "../events";
import { log_error } from "../util";

interface IScheduleTaskDragData {
    task_id: string;
    project_id: string;
    start_date: string | null;
    end_date: string | null;
}

/**
 * Handle task drag events from the schedule timeline view
 * Updates task dates and broadcasts to all users in the project room
 */
export async function on_schedule_task_drag_change(io: any, socket: Socket, data: IScheduleTaskDragData) {
    try {
        const { task_id, project_id, start_date, end_date } = data;

        if (!task_id || !project_id) {
            return;
        }

        // Validate date range
        if (start_date && end_date && new Date(end_date) < new Date(start_date)) {
            socket.emit(SocketEvents.SCHEDULE_TASK_UPDATE.toString(), {
                success: false,
                error: "End date must be after start date",
                task_id
            });
            return;
        }

        // Update task dates in database
        const updateQuery = `
            UPDATE tasks 
            SET start_date = $1, 
                end_date = $2, 
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
            RETURNING id, name, start_date, end_date, project_id
        `;

        const result = await db.query(updateQuery, [
            start_date || null,
            end_date || null,
            task_id
        ]);

        if (result.rows.length === 0) {
            socket.emit(SocketEvents.SCHEDULE_TASK_UPDATE.toString(), {
                success: false,
                error: "Task not found",
                task_id
            });
            return;
        }

        const updatedTask = result.rows[0];

        // Broadcast to all users in the project room
        io.to(project_id).emit(SocketEvents.SCHEDULE_TASK_UPDATE.toString(), {
            success: true,
            task_id: updatedTask.id,
            task_name: updatedTask.name,
            start_date: updatedTask.start_date,
            end_date: updatedTask.end_date,
            project_id: updatedTask.project_id
        });

        // Also emit the standard task date change events for consistency
        io.to(project_id).emit(SocketEvents.TASK_START_DATE_CHANGE.toString(), {
            id: task_id,
            start_date: start_date,
            parent_task: null
        });

        io.to(project_id).emit(SocketEvents.TASK_END_DATE_CHANGE.toString(), {
            id: task_id,
            end_date: end_date,
            parent_task: null
        });

    } catch (error) {
        log_error(error);
        socket.emit(SocketEvents.SCHEDULE_TASK_UPDATE.toString(), {
            success: false,
            error: "Failed to update task dates",
            task_id: data?.task_id
        });
    }
}
