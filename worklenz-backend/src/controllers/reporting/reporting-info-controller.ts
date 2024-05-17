import ReportingControllerBase from "./reporting-controller-base";
import HandleExceptions from "../../decorators/handle-exceptions";
import {IWorkLenzRequest} from "../../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../../interfaces/worklenz-response";
import db from "../../config/db";
import {ServerResponse} from "../../models/server-response";

export default class ReportingInfoController extends ReportingControllerBase {
  @HandleExceptions()
  public static async getInfo(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      SELECT organization_name
      FROM organizations
      WHERE user_id = (SELECT user_id FROM teams WHERE id = $1);
    `;
    const result = await db.query(q, [this.getCurrentTeamId(req)]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }
}
