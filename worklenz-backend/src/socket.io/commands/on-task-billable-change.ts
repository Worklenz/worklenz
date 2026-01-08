import { Server, Socket } from "socket.io";
import { log_error } from "../util";
import db from "../../config/db";
import { SocketEvents } from "../events";
import { body } from "express-validator";
import { isRestrictedFromProPlanFeatures } from "../../middlewares/subscription-middleware";

export async function on_task_billable_change(_io: Server, socket: Socket, data?: {task_id?: string, billable?: boolean}) {
    if (typeof data == "string") {
        data = JSON.parse(data as string);
    };
    if (!data?.task_id || (typeof data.billable != "boolean")) return;
    
    try {
        // Get team_id from the task's project
        const taskQuery = `SELECT p.team_id FROM tasks t INNER JOIN projects p ON t.project_id = p.id WHERE t.id = $1`;
        const taskResult = await db.query(taskQuery, [data.task_id]);
        
        if (taskResult.rows.length === 0) {
            return;
        }
        
        const teamId = taskResult.rows[0].team_id;
        
        if (!teamId) {
            return;
        }
        
        // Check if user is restricted from billable feature
        const isRestricted = await isRestrictedFromProPlanFeatures(teamId);
        
        if (isRestricted) {
            // Emit error to client
            socket.emit(SocketEvents.TASK_BILLABLE_CHANGE.toString(), {
                id: data.task_id,
                error: "Billable feature is not available for Pro Plan and AppSumo users. Please upgrade to Business plan to access this feature."
            });
            return;
        }
        
        const q = `UPDATE tasks SET billable = $2 WHERE id = $1`;
        await db.query(q, [data?.task_id, data?.billable]);
        socket.emit(SocketEvents.TASK_BILLABLE_CHANGE.toString(), {
            id: data?.task_id
        });

    } catch (e) {
        log_error(e);
    }
}