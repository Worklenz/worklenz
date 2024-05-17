import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";

import db from "../config/db";
import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";

export default class TodoListController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      INSERT INTO personal_todo_list (name, description, color_code, user_id, index)
      VALUES ($1, $2, $3, $4, ((SELECT index FROM personal_todo_list ORDER BY index DESC LIMIT 1) + 1));
      `;
    const result = await db.query(q, [req.body.name, req.body.description, req.body.color_code, req.user?.id]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {searchQuery} = this.toPaginationOptions(req.query, ["name", "COALESCE(description, '')"]);
    const filterByDone = req.query.showCompleted ? "" : "AND done IS FALSE";
    const q = `
      SELECT id, name, description, color_code, done, created_at, updated_at
      FROM personal_todo_list
      WHERE user_id = $1 ${filterByDone} ${searchQuery}
      ORDER BY created_at DESC;
      `;
    const result = await db.query(q, [req.user?.id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async updateStatus(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `UPDATE personal_todo_list SET done = $3 WHERE id = $1 AND user_id = $2;`;
    const result = await db.query(q, [req.params.id, req.user?.id, !!req.body.done]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async update(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
    UPDATE personal_todo_list
    SET done        = $3,
        name        = $4,
        description = $5,
        color_code  = $6
    WHERE id = $1
      AND user_id = $2;
  `;
    const result = await db.query(q, [req.params.id, req.user?.id, !!req.body.done, req.body.name, req.body.description, req.body.color_code]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async updateIndex(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const from = +(req.body.from || 0);
    const to = +(req.body.to || 0);

    if (from === to)
      return res.status(200).send(new ServerResponse(true, []));

    const q = `
        UPDATE personal_todo_list
        SET index=_index
        FROM (SELECT ROW_NUMBER() OVER (
            ORDER BY index < $2 DESC, index != $3 DESC, index >= $1 DESC, index
            ) AS _index,
                    user_id AS _user_id
              FROM personal_todo_list
              WHERE user_id = $1
              ORDER BY _user_id) AS _
        WHERE user_id = _user_id
          AND index != _index;
      `;
    const result = await db.query(q, [req.user?.id, from, to]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async deleteById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `DELETE FROM personal_todo_list WHERE id = $1 AND user_id = $2;`;
    const result = await db.query(q, [req.params.id, req.user?.id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }
}
