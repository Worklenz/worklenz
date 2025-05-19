import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";

export default class RateCardController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      INSERT INTO finance_rate_cards (team_id, name)
      VALUES ($1, $2)
      RETURNING id, name, team_id, created_at, updated_at;
    `;
    const result = await db.query(q, [req.user?.team_id || null, req.body.name]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
  const { searchQuery, sortField, sortOrder, size, offset } = this.toPaginationOptions(req.query, "name");

  const q = `
    SELECT ROW_TO_JSON(rec) AS rate_cards
    FROM (
      SELECT COUNT(*) AS total,
        (
          SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t))), '[]'::JSON)
          FROM (
            SELECT id, name, team_id, created_at, updated_at
            FROM finance_rate_cards
            WHERE team_id = $1 ${searchQuery}
            ORDER BY ${sortField} ${sortOrder}
            LIMIT $2 OFFSET $3
          ) t
        ) AS data
      FROM finance_rate_cards
      WHERE team_id = $1 ${searchQuery}
    ) rec;
  `;
  const result = await db.query(q, [req.user?.team_id || null, size, offset]);
  const [data] = result.rows;

  return res.status(200).send(new ServerResponse(true, data.rate_cards || this.paginatedDatasetDefaultStruct));
}

  @HandleExceptions()
  public static async getById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      SELECT id, name, team_id, created_at, updated_at
      FROM finance_rate_cards
      WHERE id = $1 AND team_id = $2;
    `;
    const result = await db.query(q, [req.params.id, req.user?.team_id || null]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async update(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      UPDATE finance_rate_cards
      SET name = $3, updated_at = NOW()
      WHERE id = $1 AND team_id = $2
      RETURNING id, name, team_id, created_at, updated_at;
    `;
    const result = await db.query(q, [req.params.id, req.user?.team_id || null, req.body.name]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async deleteById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      DELETE FROM finance_rate_cards
      WHERE id = $1 AND team_id = $2
      RETURNING id;
    `;
    const result = await db.query(q, [req.params.id, req.user?.team_id || null]);
    return res.status(200).send(new ServerResponse(true, result.rows.length > 0));
  }
}
