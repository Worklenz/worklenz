import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";

import db from "../config/db";
import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";

export default class ProjectHealthController extends WorklenzControllerBase {
    @HandleExceptions()
    public static async get(_req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
      const q = `SELECT id, name, color_code, is_default FROM sys_project_healths ORDER BY sort_order;`;
      const result = await db.query(q, []);
      return res.status(200).send(new ServerResponse(true, result.rows));
    }
  }