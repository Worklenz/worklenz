import db from "../config/db";
import HandleExceptions from "../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import { hasBusinessPlanAccess } from "../ee/middlewares/subscription-middleware";

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
    const q = `
      SELECT
        COALESCE(restrict_task_creation, FALSE)     AS restrict_task_creation,
        COALESCE(base_currency, 'USD')              AS base_currency,
        COALESCE(timelog_backdate_limit_days, 0)    AS timelog_backdate_limit_days
      FROM organizations
      WHERE user_id = (
        SELECT user_id FROM teams WHERE id = $1 LIMIT 1
      )
      LIMIT 1;
    `;

    const result = await db.query(q, [req.user?.team_id]);
    const [data] = result.rows;

    if (!data) {
      return res.status(200).send(new ServerResponse(true, {
        restrict_task_creation: false,
        base_currency: 'USD',
        timelog_backdate_limit_days: 0,
      }));
    }

    data.timelog_backdate_limit_days = Number(data.timelog_backdate_limit_days) || 0;

    return res.status(200).send(new ServerResponse(true, data));
  }

  /**
   * PUT /api/v1/settings/configuration
   * Updates the organization-level configuration settings.
   * Requires Business Plan for restrict_task_creation.
   * base_currency is available to all admins.
   */
  @HandleExceptions()
  public static async update(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { restrict_task_creation, base_currency, timelog_backdate_limit_days } = req.body;

    // restrict_task_creation requires Business Plan
    if (restrict_task_creation !== undefined && !hasBusinessPlanAccess(req.user)) {
      return res.status(403).send(
        new ServerResponse(false, null, "This feature requires a Business plan.")
      );
    }

    // Build dynamic update — only update fields that were sent
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (restrict_task_creation !== undefined) {
      updates.push(`restrict_task_creation = $${idx++}`);
      values.push(restrict_task_creation === true);
    }

    if (base_currency !== undefined) {
      // Never allow empty/null — fall back to USD
      const normalized = base_currency
        ? String(base_currency).toUpperCase().substring(0, 10).trim()
        : 'USD';
      updates.push(`base_currency = $${idx++}`);
      values.push(normalized || 'USD');
    }

    if (timelog_backdate_limit_days !== undefined) {
      const days = Math.floor(Number(timelog_backdate_limit_days));
      if (!Number.isFinite(days) || days < 0 || days > 365) {
        return res.status(400).send(
          new ServerResponse(false, null, "Backdate limit must be between 0 and 365 days.")
        );
      }
      updates.push(`timelog_backdate_limit_days = $${idx++}`);
      values.push(days);
    }

    if (updates.length === 0) {
      return res.status(400).send(new ServerResponse(false, null, "No fields to update."));
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(req.user?.team_id);

    const q = `
      UPDATE organizations
      SET ${updates.join(", ")}
      WHERE user_id = (
        SELECT user_id FROM teams WHERE id = $${idx} LIMIT 1
      )
      RETURNING restrict_task_creation, COALESCE(base_currency, 'USD') AS base_currency, timelog_backdate_limit_days;
    `;

    const result = await db.query(q, values);
    const [data] = result.rows;

    if (data) {
      data.timelog_backdate_limit_days = Number(data.timelog_backdate_limit_days) || 0;
    }

    return res.status(200).send(new ServerResponse(true, data));
  }
}
