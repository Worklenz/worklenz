import moment from "moment";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";

import db from "../config/db";

import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import { formatDuration, formatLogText, getColor } from "../shared/utils";

interface IUserRecentTask {
    task_id: string;
    task_name: string;
    project_id: string;
    project_name: string;
    last_activity_at: string;
    activity_count: number;
}

interface IUserTimeLoggedTask {
    task_id: string;
    task_name: string;
    project_id: string;
    project_name: string;
    total_time_logged: number;
    total_time_logged_string: string;
    last_logged_at: string;
    logged_by_timer: boolean;
}

export default class UserActivityLogsController extends WorklenzControllerBase {
    @HandleExceptions()
    public static async getRecentTasks(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        if (!req.user) {
            return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
        }

        const { id: userId } = req.user;
        const { offset = 0, limit = 10 } = req.query;

        const q = `
        SELECT tal.id, tal.task_id, t.name AS task_name, tal.project_id, p.name AS project_name,
             tal.attribute_type, tal.log_type, tal.old_value, tal.new_value,
             tal.prev_string, tal.next_string, tal.created_at AS last_activity_at,
             (SELECT COUNT(*) FROM task_activity_logs WHERE task_id = tal.task_id AND user_id = $1) AS activity_count
        FROM task_activity_logs tal
        JOIN tasks t ON tal.task_id = t.id
        JOIN projects p ON tal.project_id = p.id
        WHERE tal.user_id = $1
        ORDER BY tal.created_at DESC
        LIMIT $2 OFFSET $3;
        `;

        const result = await db.query(q, [userId, limit, offset]);
        const tasks: IUserRecentTask[] = result.rows;

        return res.status(200).send(new ServerResponse(true, tasks));
    }

    @HandleExceptions()
    public static async getTimeLoggedTasks(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        if (!req.user) {
            return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
        }

        const { id: userId } = req.user;
        const { offset = 0, limit = 10 } = req.query;

        const q = `
        SELECT twl.task_id, t.name AS task_name, t.project_id, p.name AS project_name,
             SUM(twl.time_spent) AS total_time_logged,
             MAX(twl.created_at) AS last_logged_at,
             MAX(twl.logged_by_timer) AS logged_by_timer
        FROM task_work_log twl
        JOIN tasks t ON twl.task_id = t.id
        JOIN projects p ON t.project_id = p.id
        WHERE twl.user_id = $1
        GROUP BY twl.task_id, t.name, t.project_id, p.name
        ORDER BY MAX(twl.created_at) DESC
        LIMIT $2 OFFSET $3;
        `;

        const result = await db.query(q, [userId, limit, offset]);
        const tasks: IUserTimeLoggedTask[] = result.rows.map(task => ({
            ...task,
            total_time_logged_string: formatDuration(moment.duration(task.total_time_logged, "seconds")),
        })
        );

        return res.status(200).send(new ServerResponse(true, tasks));
    }
}
