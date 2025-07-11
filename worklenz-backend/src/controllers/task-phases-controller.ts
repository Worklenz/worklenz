import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";

import db from "../config/db";
import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import {getColor} from "../shared/utils";
import {TASK_STATUS_COLOR_ALPHA} from "../shared/constants";

export default class TaskPhasesController extends WorklenzControllerBase {
  private static readonly DEFAULT_PHASE_COLOR = "#fbc84c";

  @HandleExceptions()
  public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    if (!req.query.id)
      return res.status(400).send(new ServerResponse(false, null, "Invalid request"));

    // Use custom name if provided, otherwise use default naming pattern
    const phaseName = req.body.name?.trim() || 
      `Untitled Phase (${(await db.query("SELECT COUNT(*) FROM project_phases WHERE project_id = $1", [req.query.id])).rows[0].count + 1})`;

    const q = `
        INSERT INTO project_phases (name, color_code, project_id, sort_index)
        VALUES (
                $1,
                $2,
                $3,
                (SELECT COUNT(*) FROM project_phases WHERE project_id = $3) + 1)
        RETURNING id, name, color_code, sort_index;
    `;

    req.body.color_code = this.DEFAULT_PHASE_COLOR;

    const result = await db.query(q, [phaseName, req.body.color_code, req.query.id]);
    const [data] = result.rows;

    data.color_code = getColor(data.name) + TASK_STATUS_COLOR_ALPHA;

    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      SELECT id, name, color_code, (SELECT COUNT(*) FROM task_phase WHERE phase_id = project_phases.id) AS usage
      FROM project_phases
      WHERE project_id = $1
      ORDER BY sort_index DESC;
    `;
    const result = await db.query(q, [req.query.id]);

    for (const phase of result.rows)
      phase.color_code = phase.color_code + TASK_STATUS_COLOR_ALPHA;

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async update(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      UPDATE project_phases
      SET name = $3
      WHERE id = $1
        AND project_id = $2
      RETURNING id, name, color_code;
    `;

    const result = await db.query(q, [req.params.id, req.query.id, req.body.name.trim()]);
    const [data] = result.rows;

    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async updateColor(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      UPDATE project_phases SET color_code = $3 WHERE id = $1 AND project_id = $2 RETURNING id, name, color_code;
    `;

    const result = await db.query(q, [req.params.id, req.query.id, req.body.color_code.substring(0, req.body.color_code.length - 2)]);
    const [data] = result.rows;

    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async updateLabel(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
        UPDATE projects
        SET phase_label = $2
        WHERE id = $1;
    `;
    const result = await db.query(q, [req.params.id, req.body.name.trim()]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async updateSortOrder (req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const body = {
      phases: req.body.phases.reverse(),
      project_id: req.body.project_id
    };

    const q = `SELECT handle_phase_sort_order($1);`;
    const result = await db.query(q, [JSON.stringify(body)]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async deleteById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      DELETE
      FROM project_phases
      WHERE id = $1
        AND project_id = $2
    `;
    const result = await db.query(q, [req.params.id, req.query.id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }
}
