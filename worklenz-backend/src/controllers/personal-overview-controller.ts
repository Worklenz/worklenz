import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";

import db from "../config/db";
import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";

export default class PersonalOverviewController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async getTasksDueToday(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
        SELECT id,
              name,
              (SELECT name FROM projects WHERE project_id = projects.id) AS project_name,
              (SELECT name FROM task_statuses WHERE id = t.status_id) AS status,
              (SELECT task_priorities.name FROM task_priorities WHERE id = t.priority_id) AS priority,
              start_date,
              end_date
        FROM tasks t
                JOIN tasks_assignees ta ON t.id = ta.task_id
        WHERE t.archived IS FALSE AND t.end_date::DATE = NOW()::DATE
          AND is_member_of_project(t.project_id, $2, $1)
        ORDER BY end_date DESC
        LIMIT 5;
      `;
    const result = await db.query(q, [req.user?.team_id || null, req.user?.id || null]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getTasksRemaining(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
    SELECT id,
          name,
          (SELECT name FROM projects WHERE project_id = projects.id) AS project_name,
          (SELECT name FROM task_statuses WHERE id = t.status_id) AS status,
          (SELECT task_priorities.name FROM task_priorities WHERE id = t.priority_id) AS priority,
          start_date,
          end_date
    FROM tasks t
            JOIN tasks_assignees ta ON t.id = ta.task_id
    WHERE t.archived IS FALSE AND t.end_date::DATE > NOW()::DATE
      AND is_member_of_project(t.project_id, $2, $1)
    ORDER BY end_date DESC
    LIMIT 5;
  `;
    const result = await db.query(q, [req.user?.team_id || null, req.user?.id || null]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getTaskOverview(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
    SELECT id,
     name,
     color_code,
     (SELECT MIN(start_date) FROM tasks WHERE archived IS FALSE AND project_id = projects.id) AS min_date,
     (SELECT MAX(end_date) FROM tasks WHERE archived IS FALSE AND project_id = projects.id)   AS max_date
    FROM projects
    WHERE team_id = $1
      AND (CASE
               WHEN (is_owner($2, $1) OR
                     is_admin($2, $1)) THEN TRUE
               ELSE is_member_of_project(projects.id, $2,
                                         $1) END)
    ORDER BY NAME;
  `;
    const result = await db.query(q, [req.user?.team_id || null, req.user?.id || null]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }
}
