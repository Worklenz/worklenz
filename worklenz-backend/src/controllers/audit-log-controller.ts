import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";

import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import { DEFAULT_PAGE_SIZE } from "../shared/constants";
import { buildAuditEventsWhereClause, parseAuditLogFilters } from "../shared/audit-log-query";
import { AUDIT_EVENT_CATEGORY, AUDIT_EVENT_TYPE } from "../shared/audit-log-constants";

/**
 * Read path for the workspace-wide Audit Log (Admin Center > Security > Audit Log).
 * Audit log spec, task 4.
 *
 * Mounted at GET /api/v1/admin-center/organization/audit-log (see
 * routes/apis/admin-center-api-router.ts), alongside the other /organization/* endpoints -
 * this is organization-wide, not per-team, consistent with the write path (see the scope
 * note in database/pg-migrations/1791193625587_create-audit-events-table.js).
 *
 * Access guard (task 4.4) is enforced by auditLogAccessValidator at the route level, not in
 * this controller - see middlewares/validators/audit-log-access-validator.ts.
 *
 * Filter parsing/WHERE-building lives in shared/audit-log-query.ts, shared with the CSV
 * export paths (task 5) so "export honors current filters" is structurally guaranteed, not
 * just a comment.
 */
export default class AuditLogController extends WorklenzControllerBase {
  /**
   * Task 4.1 + 4.2 + 4.3: GET /organization/audit-log
   *
   * Query params (all optional except organization scoping, which comes from the session):
   * - index: 1-based page number (default 1)
   * - size: page size (default DEFAULT_PAGE_SIZE)
   * - start_date / end_date: inclusive date range, "YYYY-MM-DD" (whole end_date day is
   *   included)
   * - category: comma-separated list of audit_events.category values (multi-select)
   * - actor_user_id: comma-separated list of actor_user_id UUIDs
   * - search: free-text match against description, actor_name, and event type labels
   *   (task 4.3 - resolved spike 0.6 as "yes": the design mockup's prototype ships a
   *   free-text search box filtering actor/event/detail, so v1 includes it)
   */
  @HandleExceptions()
  public static async getAuditEvents(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_id;
    if (!organizationId) {
      return res.status(200).send(new ServerResponse(false, null, "Organization not found"));
    }

    const index = Math.max(1, +(req.query.index || 1));
    const size = Math.max(1, Math.min(+(req.query.size || DEFAULT_PAGE_SIZE), 200));
    const offset = (index - 1) * size;

    const filters = parseAuditLogFilters(req.query as Record<string, unknown>, req.user?.timezone_name);
    const { whereClause, params, nextParamIndex } = buildAuditEventsWhereClause(organizationId, filters);

    // COUNT(*) OVER() keeps this a single round trip instead of a separate count query,
    // and still returns zero rows cleanly (with total = 0) when nothing matches.
    const q = `
      SELECT id,
             created_at,
             actor_user_id,
             actor_name,
             category,
             event_type,
             description,
             old_value,
             new_value,
             team_id,
             ${ACTOR_IN_WORKSPACE_SQL} AS actor_in_workspace,
             COUNT(*) OVER() AS total
      FROM audit_events
      WHERE ${whereClause}
      ORDER BY created_at DESC, id DESC
      LIMIT $${nextParamIndex} OFFSET $${nextParamIndex + 1};
    `;
    const queryParams = [...params, size, offset];

    const result = await db.query(q, queryParams);
    const total = result.rows[0]?.total ? +result.rows[0].total : 0;
    const data = result.rows.map((row) => ({
      id: row.id,
      created_at: row.created_at,
      actor_user_id: row.actor_user_id,
      actor_name: row.actor_name,
      category: row.category,
      event_type: row.event_type,
      description: row.description,
      old_value: row.old_value,
      new_value: row.new_value,
      team_id: row.team_id,
      actor_in_workspace: row.actor_in_workspace === true,
    }));

    return res.status(200).send(new ServerResponse(true, { total, data }));
  }

  /**
   * GET /organization/audit-log/summary — totals behind the page's stat cards and category
   * chips. Honors the same date/actor/search filters as the list, but ignores the category
   * filter so every chip can show its own count.
   */
  @HandleExceptions()
  public static async getSummary(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_id;
    if (!organizationId) {
      return res.status(200).send(new ServerResponse(false, null, "Organization not found"));
    }

    const filters = {
      ...parseAuditLogFilters(req.query as Record<string, unknown>, req.user?.timezone_name),
      categories: [],
    };
    const { whereClause, params, nextParamIndex } = buildAuditEventsWhereClause(organizationId, filters);

    const q = `
      SELECT category,
             COUNT(*) AS total,
             COUNT(*) FILTER (WHERE event_type = $${nextParamIndex}) AS failed_logins
      FROM audit_events
      WHERE ${whereClause}
      GROUP BY category;
    `;
    const result = await db.query(q, [...params, AUDIT_EVENT_TYPE.LOGIN_FAILED.id]);

    const byCategory = AUDIT_EVENT_CATEGORY_IDS.reduce<Record<string, number>>(
      (acc, id) => ({ ...acc, [id]: 0 }),
      {}
    );
    let failedLogins = 0;
    for (const row of result.rows) {
      byCategory[row.category] = +row.total;
      failedLogins += +row.failed_logins;
    }
    const total = Object.values(byCategory).reduce((sum, count) => sum + count, 0);

    return res.status(200).send(
      new ServerResponse(true, { total, failed_logins: failedLogins, by_category: byCategory })
    );
  }
}

const AUDIT_EVENT_CATEGORY_IDS = Object.values(AUDIT_EVENT_CATEGORY).map((category) => category.id);

/**
 * Whether the actor is the organization owner or still a member of any team in this
 * organization (teams belong to the organization whose owner owns them). Drives the "removed
 * from workspace" note next to names that are kept on the row for record accuracy. The owner
 * is checked separately because some older workspaces have no team_members row for them.
 */
const ACTOR_IN_WORKSPACE_SQL = `(
               EXISTS (
                 SELECT 1
                 FROM organizations o
                 WHERE o.id = audit_events.organization_id
                   AND o.user_id = audit_events.actor_user_id
               )
               OR EXISTS (
                 SELECT 1
                 FROM team_members tm
                 JOIN teams t ON t.id = tm.team_id
                 JOIN organizations o ON o.user_id = t.user_id
                 WHERE tm.user_id = audit_events.actor_user_id
                   AND o.id = audit_events.organization_id
               )
             )`;
