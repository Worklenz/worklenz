import db from "../../config/db";
import HandleExceptions from "../../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import WorklenzControllerBase from "../worklenz-controller-base";
import { getColor } from "../../shared/utils";
import { SocketEvents } from "../../socket.io/events";
import { IO } from "../../shared/io";

interface ITaskTimelineFilters {
    startDate?: string;
    endDate?: string;
    memberId?: string;
    projectId?: string;
    statusId?: string;
    priorityId?: string;
}

export default class TaskTimelineController extends WorklenzControllerBase {
    /**
     * Get tasks for timeline view with assignees, dates, and project info
     * Supports filtering by date range, member, project, status, and priority
     */
    @HandleExceptions()
    public static async getTasksForTimeline(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        const { startDate, endDate, memberId, projectId, statusId, priorityId } = req.query as ITaskTimelineFilters;

        const params: any[] = [req.user?.team_id];
        let paramIndex = 2;

        // Build dynamic WHERE clause
        let whereClause = `WHERE p.team_id = $1 AND t.archived = false`;

        if (startDate) {
            whereClause += ` AND (t.end_date >= $${paramIndex} OR t.end_date IS NULL)`;
            params.push(startDate);
            paramIndex++;
        }

        if (endDate) {
            whereClause += ` AND (t.start_date <= $${paramIndex} OR t.start_date IS NULL)`;
            params.push(endDate);
            paramIndex++;
        }

        if (memberId) {
            whereClause += ` AND ta.team_member_id = $${paramIndex}`;
            params.push(memberId);
            paramIndex++;
        }

        if (projectId) {
            whereClause += ` AND t.project_id = $${paramIndex}`;
            params.push(projectId);
            paramIndex++;
        }

        if (statusId) {
            whereClause += ` AND t.status_id = $${paramIndex}`;
            params.push(statusId);
            paramIndex++;
        }

        if (priorityId) {
            whereClause += ` AND t.priority_id = $${paramIndex}`;
            params.push(priorityId);
            paramIndex++;
        }

        const query = `
            SELECT 
                t.id,
                t.name,
                t.start_date,
                t.end_date,
                t.parent_task_id,
                t.project_id,
                t.done,
                t.total_minutes,
                p.name AS project_name,
                p.color_code AS project_color,
                ts.id AS status_id,
                ts.name AS status_name,
                ts.color_code AS status_color,
                stsc.is_done AS is_done_status,
                tp.id AS priority_id,
                tp.name AS priority_name,
                tp.color_code AS priority_color,
                COALESCE(
                    (SELECT json_agg(json_build_object(
                        'id', tm.id,
                        'user_id', u.id,
                        'name', u.name,
                        'email', u.email,
                        'avatar_url', u.avatar_url
                    ))
                    FROM tasks_assignees ta2
                    JOIN team_members tm ON ta2.team_member_id = tm.id
                    JOIN users u ON tm.user_id = u.id
                    WHERE ta2.task_id = t.id),
                    '[]'::json
                ) AS assignees,
                COALESCE(
                    (SELECT COUNT(*) FROM tasks st WHERE st.parent_task_id = t.id AND st.archived = false),
                    0
                ) AS subtask_count,
                COALESCE(
                    (SELECT COUNT(*) FROM tasks st 
                     JOIN task_statuses sts ON st.status_id = sts.id
                     JOIN sys_task_status_categories stsc2 ON sts.category_id = stsc2.id
                     WHERE st.parent_task_id = t.id AND st.archived = false AND stsc2.is_done = true),
                    0
                ) AS completed_subtask_count
            FROM tasks t
            JOIN projects p ON t.project_id = p.id
            JOIN task_statuses ts ON t.status_id = ts.id
            LEFT JOIN sys_task_status_categories stsc ON ts.category_id = stsc.id
            JOIN task_priorities tp ON t.priority_id = tp.id
            LEFT JOIN tasks_assignees ta ON t.id = ta.task_id
            ${whereClause}
            AND t.parent_task_id IS NULL
            GROUP BY t.id, p.id, p.name, p.color_code, ts.id, ts.name, ts.color_code, stsc.is_done, tp.id, tp.name, tp.color_code
            ORDER BY t.start_date ASC NULLS LAST, t.name ASC
            LIMIT 5000
        `;

        const result = await db.query(query, params);

        return res.status(200).send(new ServerResponse(true, result.rows));
    }

    /**
     * Update task start and end dates (for drag-drop functionality)
     */
    @HandleExceptions()
    public static async updateTaskDates(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        const { taskId } = req.params;
        const { start_date, end_date } = req.body;

        // Validate date range
        if (start_date && end_date && new Date(end_date) < new Date(start_date)) {
            return res.status(400).send(new ServerResponse(false, null, "End date must be after start date"));
        }

        // Update task dates
        const updateQuery = `
            UPDATE tasks 
            SET start_date = $1, 
                end_date = $2, 
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
            RETURNING id, name, start_date, end_date, project_id
        `;

        const result = await db.query(updateQuery, [start_date || null, end_date || null, taskId]);

        if (result.rows.length === 0) {
            return res.status(404).send(new ServerResponse(false, null, "Task not found"));
        }

        const updatedTask = result.rows[0];

        // Emit Socket.IO event for real-time updates
        const io = IO.getInstance();
        if (io) {
            io.to(updatedTask.project_id).emit(
                SocketEvents.TASK_START_DATE_CHANGE.toString(),
                {
                    task_id: taskId,
                    start_date: start_date,
                    end_date: end_date,
                    project_id: updatedTask.project_id
                }
            );
        }

        // Log activity
        await TaskTimelineController.logTaskDateChange(taskId, req.user?.id, start_date, end_date);

        return res.status(200).send(new ServerResponse(true, updatedTask, "Task dates updated successfully"));
    }

    /**
     * Get scheduling conflicts for a task
     */
    @HandleExceptions()
    public static async getTaskConflicts(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        const { taskId } = req.params;

        // Get task details with assignees
        const taskQuery = `
            SELECT 
                t.id,
                t.start_date,
                t.end_date,
                COALESCE(
                    (SELECT json_agg(ta.team_member_id)
                     FROM tasks_assignees ta
                     WHERE ta.task_id = t.id),
                    '[]'::json
                ) AS assignee_ids
            FROM tasks t
            WHERE t.id = $1
        `;

        const taskResult = await db.query(taskQuery, [taskId]);

        if (taskResult.rows.length === 0) {
            return res.status(404).send(new ServerResponse(false, null, "Task not found"));
        }

        const task = taskResult.rows[0];
        const conflicts: any[] = [];

        if (!task.start_date || !task.end_date || !task.assignee_ids?.length) {
            return res.status(200).send(new ServerResponse(true, { conflicts: [] }));
        }

        // Check for time-off conflicts
        const timeOffQuery = `
            SELECT 
                mto.id,
                mto.team_member_id,
                mto.start_date,
                mto.end_date,
                mto.reason,
                u.name AS member_name
            FROM member_time_off mto
            JOIN team_members tm ON mto.team_member_id = tm.id
            JOIN users u ON tm.user_id = u.id
            WHERE mto.team_member_id = ANY($1::uuid[])
            AND (
                (mto.start_date <= $2 AND mto.end_date >= $2)
                OR (mto.start_date <= $3 AND mto.end_date >= $3)
                OR (mto.start_date >= $2 AND mto.end_date <= $3)
            )
        `;

        const timeOffResult = await db.query(timeOffQuery, [
            task.assignee_ids,
            task.start_date,
            task.end_date
        ]);

        for (const timeOff of timeOffResult.rows) {
            conflicts.push({
                type: 'time-off',
                severity: 'high',
                message: `${timeOff.member_name} has time-off from ${new Date(timeOff.start_date).toLocaleDateString()} to ${new Date(timeOff.end_date).toLocaleDateString()}`,
                details: timeOff
            });
        }

        // Check for overallocation (multiple tasks same assignee same time)
        const overallocationQuery = `
            SELECT 
                t.id AS task_id,
                t.name AS task_name,
                t.start_date,
                t.end_date,
                ta.team_member_id,
                u.name AS member_name
            FROM tasks t
            JOIN tasks_assignees ta ON t.id = ta.task_id
            JOIN team_members tm ON ta.team_member_id = tm.id
            JOIN users u ON tm.user_id = u.id
            WHERE ta.team_member_id = ANY($1::uuid[])
            AND t.id != $2
            AND t.archived = false
            AND (
                (t.start_date <= $3 AND t.end_date >= $3)
                OR (t.start_date <= $4 AND t.end_date >= $4)
                OR (t.start_date >= $3 AND t.end_date <= $4)
            )
        `;

        const overallocationResult = await db.query(overallocationQuery, [
            task.assignee_ids,
            taskId,
            task.start_date,
            task.end_date
        ]);

        for (const overlap of overallocationResult.rows) {
            conflicts.push({
                type: 'overallocation',
                severity: 'medium',
                message: `${overlap.member_name} is also assigned to "${overlap.task_name}" during this period`,
                details: overlap
            });
        }

        return res.status(200).send(new ServerResponse(true, { conflicts }));
    }

    /**
     * Log task date change activity
     */
    private static async logTaskDateChange(
        taskId: string,
        userId: string | undefined,
        startDate: string | null,
        endDate: string | null
    ): Promise<void> {
        if (!userId) return;

        try {
            const logQuery = `
                INSERT INTO task_activity_logs (task_id, user_id, attribute_type, log, created_at)
                VALUES ($1, $2, 'dates', $3, CURRENT_TIMESTAMP)
            `;

            const logMessage = `Updated task dates: ${startDate ? new Date(startDate).toLocaleDateString() : 'none'} - ${endDate ? new Date(endDate).toLocaleDateString() : 'none'}`;

            await db.query(logQuery, [taskId, userId, logMessage]);
        } catch (error) {
            console.error('Failed to log task date change:', error);
        }
    }
}
