import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";

import db from "../config/db";
import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";

export default class OverviewController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async getById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      SELECT id,
             name,
             color_code,
             notes,
             (SELECT name FROM clients WHERE id = projects.client_id) AS client_name,

             (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
              FROM (SELECT team_member_id AS id,
                           (SELECT task_id
                            FROM tasks_assignees
                            WHERE EXISTS(SELECT id FROM tasks WHERE project_id = $1)
                              AND project_member_id = id) AS task_count,
                           (SELECT name
                            FROM users
                            WHERE id =
                                  (SELECT user_id
                                   FROM team_members
                                   WHERE team_member_id = project_members.team_member_id)),
                           (SELECT name
                            FROM job_titles
                            WHERE id = (SELECT job_title_id
                                        FROM team_members
                                        WHERE id = project_members.team_member_id)) AS job_title
                    FROM project_members
                    WHERE project_id = projects.id
                    ORDER BY name ASC) rec) AS members,

             (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
              FROM (SELECT id, name, done FROM tasks WHERE project_id = projects.id ORDER BY name ASC) rec) AS tasks
      FROM projects
      WHERE id = $1
        AND team_id = $2;
    `;
    const result = await db.query(q, [req.params.id, req.user?.team_id || null]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }
}
