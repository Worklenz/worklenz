import db from "../config/db";
import HandleExceptions from "../decorators/handle-exceptions";
import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";
import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";

export default class TaskListColumnsController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async getProjectTaskListColumns(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      SELECT name,
             key,
             index,
             pinned,
             (SELECT phase_label FROM projects WHERE id = $1) AS phase_label
      FROM project_task_list_cols
      WHERE project_id = $1
      ORDER BY index;
    `;

    const result = await db.query(q, [req.params.id]);
    const phase = result.rows.find(phase => phase.key === "PHASE");
    if (phase)
      phase.name = phase.phase_label;

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async toggleColumn(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `UPDATE project_task_list_cols
               SET pinned = $3
               WHERE project_id = $1
                 AND key = $2 RETURNING *;`;
    const result = await db.query(q, [req.params.id, req.body.key, !!req.body.pinned]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }
}
