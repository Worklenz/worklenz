import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";

import db from "../config/db";
import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import {PriorityColorCodes, PriorityColorCodesDark} from "../shared/constants";

export default class TaskPrioritiesController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async get(_req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT id, name, value From task_priorities ORDER BY value;`;
    const result = await db.query(q, []);
    for (const item of result.rows) {
      item.color_code = PriorityColorCodes[item.value] || PriorityColorCodes["0"];
      item.color_code_dark = PriorityColorCodesDark[item.value] || PriorityColorCodesDark["0"];
    }
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getById(_req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT id, name From priorities WHERE id=$1;`;
    const result = await db.query(q, [_req.params.id]);
    const data = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

}
