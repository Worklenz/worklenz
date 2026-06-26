import db from "../config/db";
import HandleExceptions from "../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import business from "../business";

export default class OrgConfigurationController extends WorklenzControllerBase {

  /**
   * GET /api/v1/settings/configuration
   * Returns the organization-level configuration settings.
   */
  @HandleExceptions()
  public static async get(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const userId = req.user?.id;

    const q = `
      SELECT
        COALESCE(restrict_task_creation, FALSE) AS restrict_task_creation
      FROM organizations
      WHERE user_id = (
        SELECT user_id FROM teams WHERE id = $1 LIMIT 1
      )
      LIMIT 1;
    `;

    const result = await db.query(q, [req.user?.team_id]);
    const [data] = result.rows;

    return res.status(200).send(new ServerResponse(true, data || { restrict_task_creation: false }));
  }

  /**
   * PUT /api/v1/settings/configuration
   * Updates the organization-level configuration settings.
   * Requires Business Plan.
   */
  @HandleExceptions()
  public static async update(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    if (!business.featureGate.hasBusinessAccess(req.user)) {
      return res.status(403).send(
        new ServerResponse(false, null, "This feature requires a Business plan.")
      );
    }

    const { restrict_task_creation } = req.body;

    const q = `
      UPDATE organizations
      SET restrict_task_creation = $1,
          updated_at             = CURRENT_TIMESTAMP
      WHERE user_id = (
        SELECT user_id FROM teams WHERE id = $2 LIMIT 1
      )
      RETURNING restrict_task_creation;
    `;

    const result = await db.query(q, [
      restrict_task_creation === true,
      req.user?.team_id,
    ]);
    const [data] = result.rows;

    return res.status(200).send(new ServerResponse(true, data));
  }
}
