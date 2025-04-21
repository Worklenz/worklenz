import moment from "moment";

import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";

import db from "../config/db";
import {ServerResponse} from "../models/server-response";
import {PriorityColorCodes, PriorityColorCodesDark, TASK_PRIORITY_COLOR_ALPHA, TASK_STATUS_COLOR_ALPHA} from "../shared/constants";
import {getColor} from "../shared/utils";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";

export default class SubTasksController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async getNames(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT name FROM tasks WHERE archived IS FALSE AND parent_task_id = $1;`;
    const result = await db.query(q, [req.params.id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
        SELECT t.id,
              t.name,
              t.description,
              t.project_id,
              t.parent_task_id,
              t.priority_id AS priority,
              tp.name AS priority_name,
              t.end_date,
              (ts.id) AS status,
              (ts.name) AS status_name,
              TRUE AS is_sub_task,
              (tsc.color_code) AS status_color,
              (tsc.color_code_dark) AS status_color_dark,
              (SELECT name FROM projects WHERE id = t.project_id) AS project_name,
              (SELECT value FROM task_priorities WHERE id = t.priority_id) AS priority_value,
              total_minutes,
              (SELECT SUM(time_spent) FROM task_work_log WHERE task_id = t.id) AS total_minutes_spent,
              (SELECT get_task_assignees(t.id)) AS assignees,
              (SELECT ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r)))
              FROM (SELECT task_labels.label_id AS id,
                           (SELECT name FROM team_labels WHERE id = task_labels.label_id),
                           (SELECT color_code FROM team_labels WHERE id = task_labels.label_id)
                    FROM task_labels
                    WHERE task_id = t.id
                    ORDER BY name) r) AS labels,
              (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                FROM (SELECT task_statuses.id, task_statuses.name, stsc.color_code, stsc.color_code_dark
                      FROM task_statuses
                              INNER JOIN sys_task_status_categories stsc ON task_statuses.category_id = stsc.id
                      WHERE project_id = t.project_id
                      ORDER BY task_statuses.name) rec) AS statuses,
              t.completed_at
        FROM tasks t
                INNER JOIN task_statuses ts ON ts.id = t.status_id
                INNER JOIN task_priorities tp ON tp.id = t.priority_id
                LEFT JOIN sys_task_status_categories tsc ON ts.category_id = tsc.id
        WHERE parent_task_id = $1
        ORDER BY created_at;
      `;
    const result = await db.query(q, [req.params.id]);

    for (const task of result.rows) {
      task.priority_color = PriorityColorCodes[task.priority_value] || null;
      task.priority_color_dark = PriorityColorCodesDark[task.priority_value] || null;

      task.time_spent = {hours: Math.floor(task.total_minutes_spent / 60), minutes: task.total_minutes_spent % 60};
      task.time_spent_string = `${task.time_spent.hours}h ${task.time_spent.minutes}m`;
      task.total_time_string = `${Math.floor(task.total_minutes / 60)}h ${task.total_minutes % 60}m`;

      task.assignees.map((a: any) => a.color_code = getColor(a.name));
      task.names = this.createTagList(task.assignees);
      task.labels = this.createTagList(task.labels, 2);

      task.status_color = task.status_color + TASK_STATUS_COLOR_ALPHA;
      task.status_color_dark = task.status_color_dark + TASK_STATUS_COLOR_ALPHA;
      task.priority_color = task.priority_color + TASK_PRIORITY_COLOR_ALPHA;
    }

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getSubTasksRoadMap(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const dates = req.body;
    const q = `
        SELECT tasks.id,
              tasks.name,
              tasks.start_date,
              tasks.end_date,
              tp.name AS priority,
              tasks.end_date,
              (SELECT name FROM task_statuses WHERE id = tasks.status_id) AS status,
              (SELECT color_code
                FROM sys_task_status_categories
                WHERE id = (SELECT category_id FROM task_statuses WHERE id = tasks.status_id)) AS status_color,
              (SELECT get_task_assignees(tasks.id)) AS assignees
        FROM tasks
                INNER JOIN task_statuses ts ON ts.task_id = tasks.id
                INNER JOIN task_priorities tp ON tp.id = tasks.priority_id
        WHERE archived IS FALSE AND parent_task_id = $1
        ORDER BY created_at DESC;
      `;
    const result = await db.query(q, [req.params.id]);

    const maxInlineNames = 4;
    for (const task of result.rows) {
      task.assignees.map((a: any) => a.color_code = getColor(a.name));
      task.names = this.createTagList(task.assignees);

      if (task?.assignees.length <= maxInlineNames) {
        const min: number = dates.findIndex((date: any) => moment(task.start_date).isSame(date.date, "days"));
        const max: number = dates.findIndex((date: any) => moment(task.end_date).isSame(date.date, "days"));
        task.min = min + 1;
        task.max = max > 0 ? max + 2 : max;
      }
    }

    return res.status(200).send(new ServerResponse(true, result.rows));
  }
}
