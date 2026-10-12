import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";

import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";

export default class PracticesController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async create(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    const { name } = req.body;
    const q = `INSERT INTO practices (name, team_id) VALUES ($1, $2) RETURNING id, name;`;
    const result = await db.query(q, [name, req.user?.team_id || null]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async get(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    const { searchQuery, searchParams, sortField, sortOrder, size, offset } =
      this.toPaginationOptions(req.query, "name", false, 4);

    const q = `
      SELECT ROW_TO_JSON(rec) AS practices
      FROM (
        SELECT COUNT(*) AS total,
               (
                 SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t))), '[]'::JSON)
                 FROM (
                   SELECT id, name
                   FROM practices
                   WHERE team_id = $1 ${searchQuery}
                   ORDER BY ${sortField} ${sortOrder}
                   LIMIT $2 OFFSET $3
                 ) t
               ) AS data
        FROM practices
        WHERE team_id = $1 ${searchQuery}
      ) rec;
    `;

    const result = await db.query(q, [
      req.user?.team_id || null,
      size,
      offset,
      ...searchParams,
    ]);
    const [data] = result.rows;
    return res
      .status(200)
      .send(
        new ServerResponse(
          true,
          data.practices || this.paginatedDatasetDefaultStruct,
        ),
      );
  }

  @HandleExceptions()
  public static async getById(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    const q = `SELECT id, name FROM practices WHERE id = $1 AND team_id = $2;`;
    const result = await db.query(q, [req.params.id, req.user?.team_id || null]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async update(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    const q = `UPDATE practices SET name = $1, updated_at = NOW() WHERE id = $2 AND team_id = $3 RETURNING id, name;`;
    const result = await db.query(q, [
      req.body.name,
      req.params.id,
      req.user?.team_id || null,
    ]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async deleteById(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    const q = `DELETE FROM practices WHERE id = $1 AND team_id = $2;`;
    await db.query(q, [req.params.id, req.user?.team_id || null]);
    return res.status(200).send(new ServerResponse(true, []));
  }
}
