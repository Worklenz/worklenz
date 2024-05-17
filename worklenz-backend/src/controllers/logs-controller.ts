import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";

import db from "../config/db";
import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";

export default class LogsController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async getActivityLog(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      SELECT description, (SELECT name FROM projects WHERE projects.id = project_logs.project_id) AS project_name, created_at
      FROM project_logs
      WHERE team_id = $1
        AND (CASE
                WHEN (is_owner($2, $1) OR
                      is_admin($2, $1)) THEN TRUE
                ELSE is_member_of_project(project_id, $2, $1) END)
      ORDER BY created_at DESC
      LIMIT 5;
    `;
    const result = await db.query(q, [req.user?.team_id || null, req.user?.id || null]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }
}
