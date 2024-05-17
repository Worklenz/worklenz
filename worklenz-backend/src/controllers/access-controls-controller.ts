import db from "../config/db";
import HandleExceptions from "../decorators/handle-exceptions";
import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";
import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";

export default class AccessControlsController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async getRoles(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT id, name, default_role, admin_role FROM roles WHERE team_id = $1 AND owner IS FALSE ORDER BY name;`;
    const result = await db.query(q, [req.user?.team_id || null]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }
}
