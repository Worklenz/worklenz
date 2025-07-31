import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";

import db from "../config/db";
import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";

export default class JobTitlesController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {name} = req.body;
    const q = `INSERT INTO job_titles (name, team_id) VALUES ($1, (SELECT active_team FROM users WHERE id = $2::UUID));`;
    const result = await db.query(q, [name, req.user?.id || null]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {searchQuery, sortField, sortOrder, size, offset} = this.toPaginationOptions(req.query, "name");

    const q = `
      SELECT ROW_TO_JSON(rec) AS job_titles
      FROM (SELECT COUNT(*) AS total,
              (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t))), '[]'::JSON)
              FROM (SELECT id, name
                    FROM job_titles
                    WHERE team_id = $1 ${searchQuery}
                    ORDER BY ${sortField} ${sortOrder}
                    LIMIT $2 OFFSET $3) t) AS data
      FROM job_titles
      WHERE team_id = $1 ${searchQuery}) rec;
    `;
    const result = await db.query(q, [req.user?.team_id || null, size, offset]);
    const [data] = result.rows;

    return res.status(200).send(new ServerResponse(true, data.job_titles || this.paginatedDatasetDefaultStruct));
  }

  @HandleExceptions()
  public static async getById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT id, name FROM job_titles WHERE id = $1 AND team_id = $2;`;
    const result = await db.query(q, [req.params.id, req.user?.team_id || null]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async update(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `UPDATE job_titles SET name = $1 WHERE id = $2 AND team_id = $3;`;
    const result = await db.query(q, [req.body.name, req.params.id, req.user?.team_id || null]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async deleteById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `DELETE FROM job_titles WHERE id = $1 AND team_id = $2;`;
    const result = await db.query(q, [req.params.id, req.user?.team_id || null]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }
}
