import db from "../../config/db";
import HandleExceptions from "../../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import WorklenzControllerBase from "../worklenz-controller-base";

/**
 * Splits `total` into whole percentages for each of `counts`, guaranteed to sum to exactly
 * 100 (largest-remainder / Hare-Niemeyer apportionment) — rounding each count's share
 * independently can push the sum above or below 100 (e.g. 3/8 and 5/8 both round up to
 * 38 + 63 = 101), which then has to be corrected asymmetrically. Flooring every share first
 * and handing the leftover points to the counts with the largest fractional remainder avoids
 * that: it always lands on exactly 100 (when total > 0) without singling one bucket out.
 */
function distributePercentages(counts: number[], total: number): number[] {
    if (total <= 0) return counts.map(() => 0);

    const exact = counts.map(count => (count / total) * 100);
    const shares = exact.map(Math.floor);
    let remainder = 100 - shares.reduce((sum, share) => sum + share, 0);

    const byRemainingFraction = exact
        .map((value, index) => ({ index, fraction: value - shares[index] }))
        .sort((a, b) => b.fraction - a.fraction);

    for (let i = 0; i < remainder; i++) {
        shares[byRemainingFraction[i].index] += 1;
    }
    return shares;
}

export default class ProjectTimelineController extends WorklenzControllerBase {
    /**
     * Get all projects for the team with their date range and todo/doing/done task breakdown,
     * for the Planner Timeline (portfolio) view.
     */
    @HandleExceptions()
    public static async getProjectsTimeline(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        const query = `
            SELECT
                p.id,
                p.name,
                p.color_code,
                p.start_date,
                p.end_date,
                p.status_id,
                (SELECT name FROM sys_project_statuses WHERE id = p.status_id) AS status_name,
                (SELECT color_code FROM sys_project_statuses WHERE id = p.status_id) AS status_color,
                p.priority_id,
                (SELECT name FROM sys_project_priorities WHERE id = p.priority_id) AS priority_name,
                (SELECT color_code FROM sys_project_priorities WHERE id = p.priority_id) AS priority_color,
                p.category_id,
                (SELECT name FROM project_categories WHERE id = p.category_id) AS category_name,
                (SELECT color_code FROM project_categories WHERE id = p.category_id) AS category_color,
                p.client_id,
                (SELECT name FROM clients WHERE id = p.client_id) AS client_name,
                COALESCE(
                    (SELECT COUNT(*)
                     FROM tasks t
                     JOIN task_statuses ts ON t.status_id = ts.id
                     JOIN sys_task_status_categories c ON ts.category_id = c.id
                     WHERE t.project_id = p.id AND t.archived IS FALSE AND c.is_todo IS TRUE), 0
                ) AS todo_count,
                COALESCE(
                    (SELECT COUNT(*)
                     FROM tasks t
                     JOIN task_statuses ts ON t.status_id = ts.id
                     JOIN sys_task_status_categories c ON ts.category_id = c.id
                     WHERE t.project_id = p.id AND t.archived IS FALSE AND c.is_doing IS TRUE), 0
                ) AS doing_count,
                COALESCE(
                    (SELECT COUNT(*)
                     FROM tasks t
                     JOIN task_statuses ts ON t.status_id = ts.id
                     JOIN sys_task_status_categories c ON ts.category_id = c.id
                     WHERE t.project_id = p.id AND t.archived IS FALSE AND c.is_done IS TRUE), 0
                ) AS done_count,
                COALESCE(
                    (SELECT COUNT(*)
                     FROM tasks t
                     WHERE t.project_id = p.id AND t.archived IS FALSE), 0
                ) AS total_count
            FROM projects p
            WHERE p.team_id = $1
              AND NOT EXISTS (SELECT user_id FROM archived_projects WHERE user_id = $2 AND project_id = p.id)
            ORDER BY p.start_date ASC NULLS LAST;
        `;

        const result = await db.query(query, [req.user?.team_id, req.user?.id]);

        const projects = result.rows.map(project => {
            const total = parseInt(project.total_count, 10) || 0;
            const todoCount = parseInt(project.todo_count, 10) || 0;
            const doingCount = parseInt(project.doing_count, 10) || 0;
            const doneCount = parseInt(project.done_count, 10) || 0;

            // Always sums to exactly 100 (see distributePercentages) — independent rounding
            // of each share can both overshoot (e.g. 3/8 and 5/8 both round up to 38 + 63)
            // and undershoot 100, which left the timeline bar's segmented fill either
            // clipped or gapped instead of filling it edge to edge.
            const [doneProgress, doingProgress, todoProgress] = distributePercentages(
                [doneCount, doingCount, todoCount],
                total
            );

            return {
                id: project.id,
                name: project.name,
                color_code: project.color_code,
                start_date: project.start_date,
                end_date: project.end_date,
                status_id: project.status_id,
                status_name: project.status_name,
                status_color: project.status_color,
                priority_id: project.priority_id,
                priority_name: project.priority_name,
                priority_color: project.priority_color,
                category_id: project.category_id,
                category_name: project.category_name,
                category_color: project.category_color,
                client_id: project.client_id,
                client_name: project.client_name,
                todo_progress: todoProgress,
                doing_progress: doingProgress,
                done_progress: doneProgress,
                todo_count: todoCount,
                doing_count: doingCount,
                done_count: doneCount,
                total_tasks: total,
            };
        });

        return res.status(200).send(new ServerResponse(true, projects));
    }

    /**
     * Update a project's start/end date only (drag-resize on the Planner Timeline bar).
     * Scoped to the caller's active team so a dragged bar can't reach into another team's project.
     */
    @HandleExceptions()
    public static async updateProjectDates(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        const { id } = req.params;
        const { start_date, end_date } = req.body;

        if (!start_date || !end_date) {
            return res.status(400).send(new ServerResponse(false, null, "start_date and end_date are required"));
        }

        if (new Date(end_date) < new Date(start_date)) {
            return res.status(400).send(new ServerResponse(false, null, "End date must be after start date"));
        }

        const q = `
            UPDATE projects
            SET start_date = $1, end_date = $2, updated_at = CURRENT_TIMESTAMP
            WHERE id = $3 AND team_id = $4
            RETURNING id, start_date, end_date;
        `;

        const result = await db.query(q, [start_date, end_date, id, req.user?.team_id]);

        if (result.rows.length === 0) {
            return res.status(404).send(new ServerResponse(false, null, "Project not found"));
        }

        return res.status(200).send(new ServerResponse(true, result.rows[0]));
    }
}
