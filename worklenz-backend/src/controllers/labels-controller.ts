import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";

import db from "../config/db";
import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import {TASK_PRIORITY_COLOR_ALPHA, WorklenzColorCodes, WorklenzColorShades} from "../shared/constants";

export default class LabelsController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      WITH lbs AS (SELECT id,
                          name,
                          color_code,
                          (SELECT COUNT(*) FROM task_labels WHERE label_id = team_labels.id) AS usage,
                          EXISTS(SELECT 1
                                 FROM task_labels
                                 WHERE task_labels.label_id = team_labels.id
                                   AND EXISTS(SELECT 1
                                              FROM tasks
                                              WHERE id = task_labels.task_id
                                                AND project_id = $2)) AS used
                   FROM team_labels
                   WHERE team_id = $1
                   ORDER BY name)
      SELECT id, name, color_code, usage
      FROM lbs
      ORDER BY used DESC;
    `;
    const result = await db.query(q, [req.user?.team_id, req.query.project || null]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getByTask(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      SELECT (SELECT name FROM team_labels WHERE id = task_labels.label_id),
             (SELECT color_code FROM team_labels WHERE id = task_labels.label_id)
      FROM task_labels
      WHERE task_id = $1;
    `;
    const result = await db.query(q, [req.params.id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getByProject(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      SELECT id, name, color_code
      FROM team_labels
      WHERE team_id = $2
        AND EXISTS(SELECT 1
                   FROM tasks
                   WHERE project_id = $1
                     AND EXISTS(SELECT 1 FROM task_labels WHERE task_id = tasks.id AND label_id = team_labels.id))
      ORDER BY name;
    `;
    const result = await db.query(q, [req.params.id, req.user?.team_id]);

    for (const label of result.rows) {
      label.color_code = label.color_code + TASK_PRIORITY_COLOR_ALPHA;
    }

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async updateColor(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `UPDATE team_labels
               SET color_code = $3
               WHERE id = $1
                 AND team_id = $2;`;

    if (!Object.values(WorklenzColorShades).flat().includes(req.body.color))
      return res.status(400).send(new ServerResponse(false, null));

    const result = await db.query(q, [req.params.id, req.user?.team_id, req.body.color]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async updateLabel(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const updates = [];
    const values = [req.params.id, req.user?.team_id];
    let paramIndex = 3;

    if (req.body.name) {
      updates.push(`name = $${paramIndex++}`);
      values.push(req.body.name);
    }

    if (req.body.color) {
      if (!Object.values(WorklenzColorShades).flat().includes(req.body.color))
        return res.status(400).send(new ServerResponse(false, null));
      updates.push(`color_code = $${paramIndex++}`);
      values.push(req.body.color);
    }

    if (updates.length === 0) {
      return res.status(400).send(new ServerResponse(false, "No valid fields to update"));
    }

    const q = `UPDATE team_labels
               SET ${updates.join(', ')}
               WHERE id = $1
                 AND team_id = $2;`;

    const result = await db.query(q, values);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async deleteById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `DELETE
               FROM team_labels
               WHERE id = $1
                 AND team_id = $2;`;
    const result = await db.query(q, [req.params.id, req.user?.team_id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }
}
