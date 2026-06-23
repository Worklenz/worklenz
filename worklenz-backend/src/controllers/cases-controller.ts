import db from "../config/db";
import HandleExceptions from "../decorators/handle-exceptions";
import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";
import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";

const CASE_TYPE_FILTERS = new Set(["supplier_order", "repair", "shipment", "general"]);
const CASE_STATUS_FILTERS = new Set([
  "new",
  "waiting_internal",
  "waiting_external",
  "in_progress",
  "at_risk",
  "overdue",
  "done",
  "closed_problem"
]);

export default class CasesController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {
      searchQuery,
      searchParams,
      sortField,
      sortOrder,
      size,
      offset
    } = this.toPaginationOptions(req.query, ["oc.title", "oc.description", "oc.order_number"], false, 4);
    const allowedSortFields: Record<string, string> = {
      title: "oc.title",
      due_date: "oc.due_date",
      status: "oc.status",
      case_type: "oc.case_type",
      priority_score: "oc.priority_score",
      risk_score: "oc.risk_score",
      updated_at: "oc.updated_at",
      created_at: "oc.created_at"
    };
    const orderBy = allowedSortFields[String(sortField)] || "oc.updated_at";
    const queryParams: unknown[] = [req.user?.team_id, size, offset, ...searchParams];
    let filters = searchQuery;

    if (typeof req.query.case_type === "string" && CASE_TYPE_FILTERS.has(req.query.case_type)) {
      queryParams.push(req.query.case_type);
      filters += ` AND oc.case_type = $${queryParams.length}`;
    }

    if (typeof req.query.status === "string" && CASE_STATUS_FILTERS.has(req.query.status)) {
      queryParams.push(req.query.status);
      filters += ` AND oc.status = $${queryParams.length}`;
    }

    const q = `
      SELECT ROW_TO_JSON(rec) AS cases
      FROM (
        SELECT COUNT(*) AS total,
          (
            SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t))), '[]'::JSON)
            FROM (
              SELECT
                oc.id,
                oc.team_id,
                oc.title,
                oc.order_number,
                oc.description,
                oc.case_type,
                oc.status,
                p.name AS project_name,
                cp.name AS counterparty_name,
                cp.type AS counterparty_type,
                a.name AS asset_name,
                a.inventory_no AS asset_inventory_no,
                oc.due_date,
                oc.next_action_text,
                oc.next_action_due_date,
                oc.external_wait_since,
                oc.last_activity_at,
                oc.priority_score,
                oc.risk_score,
                oc.no_deadline_reason,
                oc.created_at,
                oc.updated_at,
                COALESCE(mi.currency, 'RUB') AS money_currency,
                COALESCE(mi.object_value, 0)
                  + COALESCE(mi.service_cost, 0)
                  + COALESCE(mi.potential_loss, 0) AS money_impact_total,
                jsonb_strip_nulls(
                  jsonb_build_object(
                    'currency', mi.currency,
                    'object_value', mi.object_value,
                    'service_cost', mi.service_cost,
                    'potential_loss', mi.potential_loss,
                    'downtime_cost_per_day', mi.downtime_cost_per_day,
                    'delay_cost_per_day', mi.delay_cost_per_day
                  )
                ) AS money_impact
              FROM operational_cases oc
              LEFT JOIN projects p ON p.id = oc.project_id AND p.team_id = oc.team_id
              LEFT JOIN counterparties cp ON cp.id = oc.counterparty_id AND cp.team_id = oc.team_id
              LEFT JOIN assets a ON a.id = oc.asset_id AND a.team_id = oc.team_id
              LEFT JOIN money_impacts mi ON mi.case_id = oc.id
              WHERE oc.team_id = $1 ${filters}
              ORDER BY ${orderBy} ${sortOrder}
              LIMIT $2 OFFSET $3
            ) t
          ) AS data
        FROM operational_cases oc
        WHERE oc.team_id = $1 ${filters}
      ) rec;
    `;
    const result = await db.query(q, queryParams);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data?.cases || this.paginatedDatasetDefaultStruct));
  }
}
