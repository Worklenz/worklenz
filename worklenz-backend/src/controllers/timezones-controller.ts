import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";

import db from "../config/db";
import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";

export default class TimezonesController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async get(_req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT id, name, abbrev, utc_offset FROM timezones ORDER BY name;`;
    const result = await db.query(q, []);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async update(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `UPDATE users SET timezone_id = $2 WHERE id = $1;`;
    const result = await db.query(q, [req.user?.id, req.body.timezone]);
    return res.status(200).send(new ServerResponse(true, result.rows, "Timezone updated"));
  }
}
