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
    // timezone may be omitted (e.g. a brand-new user changing only their
    // language before a timezone has ever been set) - COALESCE keeps the
    // existing timezone_id instead of nulling it out in that case.
    const q = `UPDATE users SET timezone_id = COALESCE($2, timezone_id), language = $3 WHERE id = $1;`;
    const result = await db.query(q, [req.user?.id, req.body.timezone || null, req.body.language]);
    return res.status(200).send(new ServerResponse(true, result.rows, "Updated successfully"));
  }
}
