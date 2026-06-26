import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";

import db from "../config/db";
import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";

export default class ProjectPrioritiesController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async get(_req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT id, name, value, color_code, color_code_dark FROM sys_project_priorities ORDER BY value;`;
    const result = await db.query(q, []);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getById(_req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT id, name, value, color_code, color_code_dark FROM sys_project_priorities WHERE id = $1;`;
    const result = await db.query(q, [_req.params.id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }
}
