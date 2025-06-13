import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";
import {PriorityColorCodes, TASK_STATUS_COLOR_ALPHA} from "../shared/constants";

import db from "../config/db";
import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import {formatDuration, getColor} from "../shared/utils";
import moment from "moment";

export default class ProjectInsightsController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async getById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {archived} = req.query;

    const q = `SELECT get_project_overview_data($1, $2) AS overview;`;
    const result = await db.query(q, [req.params.id, archived === "true"]);
    const [data] = result.rows;

    const {total_minutes_sum, time_spent_sum} = data.overview;

    const totalMinutes = moment.duration(total_minutes_sum, "minutes");
    const totalSeconds = moment.duration(time_spent_sum, "seconds");

    data.overview.total_estimated_hours_string = formatDuration(totalMinutes);
    data.overview.total_logged_hours_string = formatDuration(totalSeconds);

    data.overview.overlogged_hours = formatDuration(totalMinutes.subtract(totalSeconds));

    return res.status(200).send(new ServerResponse(true, data.overview));
  }

  public static async getMemberInsightsByProjectId(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {archived} = req.query;

    const q = `SELECT get_project_member_insights($1, $2) AS overview;`;
    const result = await db.query(q, [req.params.id, archived === "true"]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data.overview));
  }

  @HandleExceptions()
  public static async getLastUpdatedtasks(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {archived} = req.query;

    const q = `SELECT get_last_updated_tasks_by_project($1, $2, $3, $4) AS last_updated;`;
    const result = await db.query(q, [req.params.id, 10, 0, archived]);
    const [data] = result.rows;

    for (const task of data.last_updated) {
      task.status_color = task.status_color + TASK_STATUS_COLOR_ALPHA;
    }

    return res.status(200).send(new ServerResponse(true, data.last_updated));
  }


  @HandleExceptions()
  public static async getProjectLogs(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT description, created_at
               FROM project_logs
               WHERE project_id = $1
               ORDER BY created_at DESC
               LIMIT $2 OFFSET $3;`;
    const result = await db.query(q, [req.params.id, 10, 0]);
    return res.status(200).send(new ServerResponse(true, result.rows || []));
  }

  @HandleExceptions()
  public static async getStatusOverview(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {archived} = req.query;

    const q = `
      SELECT task_statuses.id,
             task_statuses.name,
             stsc.color_code
      FROM task_statuses
             INNER JOIN sys_task_status_categories stsc ON task_statuses.category_id = stsc.id
      WHERE project_id = $1
        AND team_id = $2
      ORDER BY task_statuses.sort_order;`;
    const status = await db.query(q, [req.params.id, req.user?.team_id]);
    const statusCounts = [];

    for (const element of status.rows) {
      const q = `SELECT COUNT(*)
                 FROM tasks
                 WHERE status_id = $1
                   AND CASE
                         WHEN ($2 IS TRUE) THEN project_id IS NOT NULL
                         ELSE archived IS FALSE END;`;
      const count = await db.query(q, [element.id, archived === "true"]);
      const [data] = count.rows;
      statusCounts.push({name: element.name, color: element.color_code, y: parseInt(data.count)});
      element.status_color = element.status_color + TASK_STATUS_COLOR_ALPHA;
    }

    return res.status(200).send(new ServerResponse(true, statusCounts || []));
  }

  @HandleExceptions()
  public static async getPriorityOverview(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {archived} = req.query;

    const q = `SELECT id, name, value
               FROM task_priorities
               ORDER BY value;`;
    const result = await db.query(q, []);
    for (const item of result.rows)
      item.color_code = PriorityColorCodes[item.value] || PriorityColorCodes["0"];

    const statusCounts = [];

    for (const element of result.rows) {
      const q = `SELECT COUNT(*)
                 FROM tasks
                 WHERE priority_id = $1
                   AND CASE
                         WHEN ($3 IS TRUE) THEN project_id IS NOT NULL
                         ELSE archived IS FALSE END
                   AND project_id = $2;`;
      const count = await db.query(q, [element.id, req.params.id, archived === "true"]);
      const [data] = count.rows;
      statusCounts.push({name: element.name, color: element.color_code, data: [parseInt(data.count)]});
    }

    return res.status(200).send(new ServerResponse(true, statusCounts || []));
  }

  @HandleExceptions()
  public static async getOverdueTasks(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {archived} = req.query;

    const q = `
      SELECT id,
             name,
             status_id AS status,
             end_date,
             priority_id AS priority,
             (SELECT name FROM task_statuses WHERE id = tasks.status_id) AS status_name,
             updated_at,
             NOW()::DATE - end_date::DATE AS days_overdue,
             (SELECT color_code
              FROM sys_task_status_categories
              WHERE id = (SELECT category_id FROM task_statuses WHERE id = status_id)) AS status_color
      FROM tasks
      WHERE project_id = $1
        AND end_date::DATE < NOW()::DATE
        AND CASE
              WHEN ($2 IS TRUE) THEN project_id IS NOT NULL
              ELSE archived IS FALSE END
        AND status_id IN (SELECT id
                          FROM task_statuses
                          WHERE project_id = $1
                            AND category_id IN
                                (SELECT id
                                 FROM sys_task_status_categories
                                 WHERE sys_task_status_categories.is_done IS FALSE));
    `;
    const result = await db.query(q, [req.params.id, archived]);

    for (const element of result.rows) {
      element.status_color = element.status_color + TASK_STATUS_COLOR_ALPHA;
    }

    return res.status(200).send(new ServerResponse(true, result.rows || []));
  }

  @HandleExceptions()
  public static async getTasksFinishedEarly(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {archived} = req.query;

    const q = `
      SELECT id,
             name,
             status_id AS status,
             end_date,
             priority_id AS priority,
             (SELECT name FROM task_statuses WHERE id = tasks.status_id) AS status_name,
             updated_at,
             completed_at,
             (SELECT color_code
              FROM sys_task_status_categories
              WHERE id = (SELECT category_id FROM task_statuses WHERE id = status_id)) AS status_color
      FROM tasks
      WHERE project_id = $1
        AND completed_at::DATE < end_date::DATE
        AND CASE
              WHEN ($2 IS TRUE) THEN project_id IS NOT NULL
              ELSE archived IS FALSE END
        AND status_id IN (SELECT id
                          FROM task_statuses
                          WHERE project_id = $1
                            AND category_id IN
                                (SELECT id
                                 FROM sys_task_status_categories
                                 WHERE sys_task_status_categories.is_done IS TRUE));
    `;
    const result = await db.query(q, [req.params.id, archived]);

    for (const element of result.rows) {
      element.status_color = element.status_color + TASK_STATUS_COLOR_ALPHA;
    }

    return res.status(200).send(new ServerResponse(true, result.rows || []));
  }

  @HandleExceptions()
  public static async getTasksFinishedLate(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {archived} = req.query;

    const q = `
      SELECT id,
             name,
             status_id AS status,
             end_date,
             priority_id AS priority,
             (SELECT name FROM task_statuses WHERE id = tasks.status_id) AS status_name,
             updated_at,
             completed_at,
             (SELECT color_code
              FROM sys_task_status_categories
              WHERE id = (SELECT category_id FROM task_statuses WHERE id = status_id)) AS status_color
      FROM tasks
      WHERE project_id = $1
        AND completed_at::DATE > end_date::DATE
        AND CASE
              WHEN ($2 IS TRUE) THEN project_id IS NOT NULL
              ELSE archived IS FALSE END
        AND status_id IN (SELECT id
                          FROM task_statuses
                          WHERE project_id = $1
                            AND category_id IN
                                (SELECT id
                                 FROM sys_task_status_categories
                                 WHERE sys_task_status_categories.is_done IS TRUE));
    `;
    const result = await db.query(q, [req.params.id, archived]);

    for (const element of result.rows) {
      element.status_color = element.status_color + TASK_STATUS_COLOR_ALPHA;
    }

    return res.status(200).send(new ServerResponse(true, result.rows || []));
  }

  @HandleExceptions()
  public static async getTasksByProjectMember(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {member_id, project_id, archived} = req.body;
    const q = `SELECT get_tasks_by_project_member($1, $2, $3)`;
    const result = await db.query(q, [project_id || null, member_id || null, archived]);
    const [data] = result.rows;

    for (const element of data.get_tasks_by_project_member) {
      element.status_color = element.status_color + TASK_STATUS_COLOR_ALPHA;
      element.total_minutes = formatDuration(moment.duration(~~(element.total_minutes), "minutes"));
      element.overlogged_time = formatDuration(moment.duration(element.overlogged_time, "seconds"));
    }

    return res.status(200).send(new ServerResponse(true, data.get_tasks_by_project_member || []));
  }

  @HandleExceptions()
  public static async getProjectDeadlineStats(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {archived} = req.query;

    const q = `SELECT get_project_deadline_tasks($1, $2);`;
    const result = await db.query(q, [req.params.id || null, archived === "true"]);
    const [data] = result.rows;

    for (const task of data.get_project_deadline_tasks.tasks) {
      task.status_color = task.status_color + TASK_STATUS_COLOR_ALPHA;
    }

    const logged_hours = data.get_project_deadline_tasks.deadline_logged_hours || 0; // in seconds
    data.get_project_deadline_tasks.deadline_logged_hours_string = formatDuration(moment.duration(logged_hours, "seconds"));

    return res.status(200).send(new ServerResponse(true, data.get_project_deadline_tasks || {}));
  }


  @HandleExceptions()
  public static async getOverloggedTasksByProject(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {archived} = req.query;

    /**
     SELECT id,
     name,
     status_id AS status,
     (SELECT name FROM task_statuses WHERE id = tasks.status_id) AS status_name,
     end_date,
     priority_id AS priority,
     updated_at,
     ((SELECT SUM(time_spent) FROM task_work_log WHERE task_id = tasks.id) - total_minutes) AS overlogged_time,
     (SELECT color_code
     FROM sys_task_status_categories
     WHERE id = (SELECT category_id FROM task_statuses WHERE id = status_id)) AS status_color,
     (SELECT get_task_assignees(tasks.id)) AS assignees
     FROM tasks
     WHERE project_id = $1
     AND CASE
     WHEN ($2 IS TRUE) THEN project_id IS NOT NULL
     ELSE archived IS FALSE END
     AND total_minutes < (SELECT SUM(time_spent) FROM task_work_log WHERE task_id = tasks.id);
     */
    const q = `
      WITH work_log AS (SELECT task_id, SUM(time_spent) AS total_time_spent
                        FROM task_work_log
                        GROUP BY task_id)
      SELECT id,
             name,
             status_id AS status,
             (SELECT name FROM task_statuses WHERE id = tasks.status_id) AS status_name,
             end_date,
             priority_id AS priority,
             updated_at,
             (work_log.total_time_spent - (total_minutes * 60)) AS overlogged_time,
             (SELECT color_code
              FROM sys_task_status_categories
              WHERE id = (SELECT category_id FROM task_statuses WHERE id = status_id)) AS status_color,
             (SELECT get_task_assignees(tasks.id)) AS assignees
      FROM tasks
             JOIN work_log ON work_log.task_id = tasks.id
      WHERE project_id = $1 AND total_minutes <> 0 AND (total_minutes * 60) <> work_log.total_time_spent
        AND CASE
              WHEN ($2 IS TRUE) THEN project_id IS NOT NULL
              ELSE archived IS FALSE END
        AND total_minutes < work_log.total_time_spent;
    `;

    const result = await db.query(q, [req.params.id || null, archived]);

    for (const task of result.rows) {
      task.overlogged_time_string = formatDuration(moment.duration(task.overlogged_time, "seconds"));
      task.assignees.map((a: any) => a.color_code = getColor(a.name));
      task.names = this.createTagList(task.assignees);
      task.status_color = task.status_color + TASK_STATUS_COLOR_ALPHA;
    }

    return res.status(200).send(new ServerResponse(true, result.rows || []));
  }
}
