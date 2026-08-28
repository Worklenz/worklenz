import moment from "moment-timezone";
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
    project_color?: string;
    task_status?: string;
    status_color?: string;
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
    billable: boolean;
    project_color?: string;
    task_status?: string;
    status_color?: string;
    log_entries_count?: number;
    estimated_time?: number;
}

export default class UserActivityLogsController extends WorklenzControllerBase {
    @HandleExceptions()
    public static async getRecentTasks(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        if (!req.user) {
            return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
        }

        const { id: userId, team_id: teamId } = req.user;
        const { offset = 0, limit = 10 } = req.query;

        // Optimized query with better performance and team filtering
        const q = `
        SELECT DISTINCT tal.task_id, t.name AS task_name, tal.project_id, p.name AS project_name,
               MAX(tal.created_at) AS last_activity_at,
               COUNT(DISTINCT tal.id) AS activity_count,
               p.color_code AS project_color,
               (SELECT name FROM task_statuses WHERE id = t.status_id) AS task_status,
               (SELECT color_code 
                FROM sys_task_status_categories 
                WHERE id = (SELECT category_id FROM task_statuses WHERE id = t.status_id)) AS status_color
        FROM task_activity_logs tal
        INNER JOIN tasks t ON tal.task_id = t.id AND t.archived = FALSE
        INNER JOIN projects p ON tal.project_id = p.id AND p.team_id = $1
        WHERE tal.user_id = $2
          AND tal.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY tal.task_id, t.name, tal.project_id, p.name, p.color_code, t.status_id
        ORDER BY MAX(tal.created_at) DESC
        LIMIT $3 OFFSET $4;
        `;

        const result = await db.query(q, [teamId, userId, limit, offset]);
        const tasks: IUserRecentTask[] = result.rows;

        return res.status(200).send(new ServerResponse(true, tasks));
    }

    @HandleExceptions()
    public static async getTimeLoggedTasks(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        if (!req.user) {
            return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
        }

        const { id: userId, team_id: teamId } = req.user;
        const { offset = 0, limit = 10 } = req.query;
        const period = req.query.period as string; // 'today' | 'week'
        const timeZone = (req.query.time_zone as string) || 'UTC';

        const params: any[] = [teamId, userId, limit, offset];
        let dateFilter = "AND twl.created_at >= NOW() - INTERVAL '90 days'";

        if (period === 'today' || period === 'week') {
            const nowInTz = moment.tz(timeZone);
            const startOfPeriod = period === 'today' ? nowInTz.clone().startOf('day') : nowInTz.clone().startOf('week');
            const endOfPeriod = period === 'today' ? nowInTz.clone().endOf('day') : nowInTz.clone().endOf('week');
            dateFilter = "AND twl.created_at >= $5 AND twl.created_at <= $6";
            params.push(startOfPeriod.toISOString(), endOfPeriod.toISOString());
        }

        // Optimized query with better performance, team filtering, and useful additional data
        const q = `
        SELECT twl.task_id, t.name AS task_name, t.project_id, p.name AS project_name,
               SUM(twl.time_spent) AS total_time_logged,
               MAX(twl.created_at) AS last_logged_at,
               MAX(twl.logged_by_timer::int)::boolean AS logged_by_timer,
               COALESCE(t.billable, TRUE) AS billable,
               p.color_code AS project_color,
               (SELECT name FROM task_statuses WHERE id = t.status_id) AS task_status,
               (SELECT color_code
                FROM sys_task_status_categories
                WHERE id = (SELECT category_id FROM task_statuses WHERE id = t.status_id)) AS status_color,
               COUNT(DISTINCT twl.id) AS log_entries_count,
               (t.total_minutes * 60) AS estimated_time
        FROM task_work_log twl
        INNER JOIN tasks t ON twl.task_id = t.id AND t.archived = FALSE
        INNER JOIN projects p ON t.project_id = p.id AND p.team_id = $1
        WHERE twl.user_id = $2
          ${dateFilter}
        GROUP BY twl.task_id, t.name, t.project_id, p.name, p.color_code, t.status_id, t.total_minutes, t.billable
        HAVING SUM(twl.time_spent) > 0
        ORDER BY MAX(twl.created_at) DESC
        LIMIT $3 OFFSET $4;
        `;

        const result = await db.query(q, params);
        const tasks: IUserTimeLoggedTask[] = result.rows.map(task => ({
            ...task,
            total_time_logged_string: formatDuration(moment.duration(task.total_time_logged, "seconds")),
        }));

        return res.status(200).send(new ServerResponse(true, tasks));
    }

    // Aggregate counterpart to getTimeLoggedTasks, for callers (HomeStatCards'
    // Focus Time tile) that only need a billable/non-billable total, not the
    // task list. Fetching a `limit`-capped list and summing it in JS silently
    // undercounts once a user logs time against more tasks than the limit in
    // a period — this sums in SQL instead, so it's correct for any task count.
    @HandleExceptions()
    public static async getTimeLoggedSummary(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        if (!req.user) {
            return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
        }

        const { id: userId, team_id: teamId } = req.user;
        const period = req.query.period as string; // 'today' | 'week'
        const timeZone = (req.query.time_zone as string) || 'UTC';

        const params: any[] = [teamId, userId];
        let dateFilter = "AND twl.created_at >= NOW() - INTERVAL '90 days'";

        if (period === 'today' || period === 'week') {
            const nowInTz = moment.tz(timeZone);
            const startOfPeriod = period === 'today' ? nowInTz.clone().startOf('day') : nowInTz.clone().startOf('week');
            const endOfPeriod = period === 'today' ? nowInTz.clone().endOf('day') : nowInTz.clone().endOf('week');
            dateFilter = "AND twl.created_at >= $3 AND twl.created_at <= $4";
            params.push(startOfPeriod.toISOString(), endOfPeriod.toISOString());
        }

        const q = `
        SELECT
            COALESCE(SUM(CASE WHEN COALESCE(t.billable, TRUE) THEN twl.time_spent END), 0)::BIGINT AS billable_seconds,
            COALESCE(SUM(CASE WHEN NOT COALESCE(t.billable, TRUE) THEN twl.time_spent END), 0)::BIGINT AS non_billable_seconds
        FROM task_work_log twl
        INNER JOIN tasks t ON twl.task_id = t.id AND t.archived = FALSE
        INNER JOIN projects p ON t.project_id = p.id AND p.team_id = $1
        WHERE twl.user_id = $2
          ${dateFilter}
        `;

        const result = await db.query(q, params);
        const [row] = result.rows;

        return res.status(200).send(new ServerResponse(true, {
            billable_seconds: Number(row?.billable_seconds) || 0,
            non_billable_seconds: Number(row?.non_billable_seconds) || 0,
        }));
    }
}
