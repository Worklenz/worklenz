import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import { getColor } from "../shared/utils";
import { getOrgFinanceSettings } from "./finance-overview-controller";
import { buildRateSql } from "../shared/finance-rate";

interface DateRange {
  start: Date;
  end: Date;
}

// Resolves rate the same way as the canonical per-project Finance tab
// (project-finance-controller.ts) and PORTFOLIO_FINANCE_SQL in
// finance-overview-controller.ts — via project_members.project_rate_card_role_id
// only, with no job-title-based fallback. Keep in sync with those controllers.
// Alias `fprr` matches what buildRateSql (shared/finance-rate.ts) expects.
const RATE_JOINS = `
  LEFT JOIN users u
    ON u.id = wl.user_id
  LEFT JOIN team_members tm
    ON tm.user_id = u.id
   AND tm.team_id = p.team_id
  LEFT JOIN project_members pm
    ON pm.project_id = t.project_id
   AND pm.team_member_id = tm.id
  LEFT JOIN finance_project_rate_card_roles fprr
    ON fprr.id = pm.project_rate_card_role_id
`;

const parseRange = (req: IWorkLenzRequest, fallback: "week" | "month"): DateRange => {
  const startParam = req.query.start as string | undefined;
  const endParam = req.query.end as string | undefined;
  if (startParam && endParam) {
    const start = new Date(startParam);
    const end = new Date(endParam);
    // Trust the caller's end-of-day boundary as-is: the frontend already
    // normalizes it (see getRangeDates in finance-report-utils.ts) and sends
    // it as a UTC instant. Re-applying setHours() here would recompute it in
    // the server's local timezone, shifting the boundary by the offset
    // difference between the browser and server.
    // Reject an inverted or unbounded range rather than running an
    // unrestricted aggregation over task_work_log for any authenticated
    // caller — fall back to the default range instead.
    const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1000;
    if (
      !Number.isNaN(start.getTime()) &&
      !Number.isNaN(end.getTime()) &&
      end.getTime() >= start.getTime() &&
      end.getTime() - start.getTime() <= MAX_RANGE_MS
    ) {
      return { start, end };
    }
  }

  const now = new Date();
  if (fallback === "week") {
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() + mondayOffset);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
};

const parsePagination = (req: IWorkLenzRequest) => {
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.page_size as string, 10) || 10));
  return { page, pageSize, offset: (page - 1) * pageSize };
};

const toNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const monthKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const monthLabel = (date: Date): string =>
  date.toLocaleString("en-US", { month: "short", year: "numeric" });

const addMonths = (date: Date, count: number): Date =>
  new Date(date.getFullYear(), date.getMonth() + count, 1);

/**
 * ETC from time-tracking velocity:
 * remaining estimated hours × realized average hourly rate.
 * Falls back to remaining-days × daily burn when dates exist, then remaining budget.
 *
 * remaining_hours and avg_hourly_cost are passed in pre-computed (rather than
 * raw estimated/logged/cost totals) so callers can scope each correctly:
 * remaining_hours should compare estimated vs. logged hours at the same task
 * scope (e.g. both top-level-only, since estimates are commonly only set on
 * top-level tasks), while avg_hourly_cost should use the true overall
 * logged-hours total for an accurate realized rate.
 */
const calculateEtc = (row: {
  budget: number;
  actual_cost: number;
  remaining_hours: number;
  avg_hourly_cost: number;
  start_date: string | Date | null;
  end_date: string | Date | null;
}): number => {
  if (row.remaining_hours > 0 && row.avg_hourly_cost > 0) {
    return row.remaining_hours * row.avg_hourly_cost;
  }

  if (row.start_date && row.end_date) {
    const start = new Date(row.start_date).getTime();
    const end = new Date(row.end_date).getTime();
    const now = Date.now();
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      const elapsedDays = Math.max((Math.min(now, end) - start) / 86_400_000, 1);
      const remainingDays = Math.max((end - now) / 86_400_000, 0);
      if (remainingDays > 0 && row.actual_cost > 0) {
        return (row.actual_cost / elapsedDays) * remainingDays;
      }
    }
  }

  return Math.max(row.budget - row.actual_cost, 0);
};

const burnAlert = (pct: number, hasBudget: boolean): "high" | "watch" | "ok" | "none" => {
  if (!hasBudget) return "none";
  if (pct > 85) return "high";
  if (pct > 65) return "watch";
  return "ok";
};

const utilizationStatus = (pct: number): "high" | "watch" | "ok" => {
  if (pct > 85) return "high";
  if (pct > 65) return "watch";
  return "ok";
};

const linearNext = (values: number[], steps: number): number[] => {
  if (values.length === 0) return Array.from({ length: steps }, () => 0);
  if (values.length === 1) return Array.from({ length: steps }, () => Math.max(values[0], 0));
  const first = values[0];
  const last = values[values.length - 1];
  const slope = (last - first) / Math.max(values.length - 1, 1);
  return Array.from({ length: steps }, (_, i) => Math.max(last + slope * (i + 1), 0));
};

export default class FinanceReportsController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async getBudgets(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const userId = req.user?.id;

    if (!teamId) {
      return res.status(400).send(new ServerResponse(false, null, "Missing team context"));
    }

    const { calcMethod, hoursPerDay } = await getOrgFinanceSettings(teamId);
    const rateSql = buildRateSql(calcMethod, hoursPerDay);

    const q = `
      SELECT
        p.id,
        p.name,
        COALESCE(p.color_code, '#1890ff') AS color_code,
        c.name AS client_name,
        COALESCE(p.budget, 0)::FLOAT AS budget,
        COALESCE(p.currency, 'USD') AS currency,
        p.start_date,
        p.end_date,
        COALESCE((
          SELECT SUM(COALESCE(t.fixed_cost, 0))
          FROM tasks t
          WHERE t.project_id = p.id AND t.archived = false
        ), 0)::FLOAT AS fixed_cost,
        COALESCE((
          SELECT SUM(
            (COALESCE(wl.time_spent, 0)::FLOAT / 3600.0) * ${rateSql}
          )
          FROM tasks t
          JOIN task_work_log wl ON wl.task_id = t.id
          ${RATE_JOINS}
          WHERE t.project_id = p.id AND t.archived = false
        ), 0)::FLOAT AS time_based_cost,
        COALESCE((
          SELECT SUM(COALESCE(t.total_minutes, 0))::FLOAT / 60.0
          FROM tasks t
          WHERE t.project_id = p.id AND t.archived = false AND t.parent_task_id IS NULL
        ), 0)::FLOAT AS estimated_hours,
        COALESCE((
          SELECT SUM(COALESCE(wl.time_spent, 0))::FLOAT / 3600.0
          FROM tasks t
          JOIN task_work_log wl ON wl.task_id = t.id
          WHERE t.project_id = p.id AND t.archived = false
        ), 0)::FLOAT AS logged_hours,
        -- Scoped to top-level tasks only, matching estimated_hours' scope, so
        -- calculateEtc compares like with like — the broader logged_hours
        -- above (all tasks, including subtasks) is for display only.
        COALESCE((
          SELECT SUM(COALESCE(wl.time_spent, 0))::FLOAT / 3600.0
          FROM tasks t
          JOIN task_work_log wl ON wl.task_id = t.id
          WHERE t.project_id = p.id AND t.archived = false AND t.parent_task_id IS NULL
        ), 0)::FLOAT AS top_level_logged_hours
      FROM projects p
      LEFT JOIN clients c ON c.id = p.client_id
      WHERE p.team_id = $1
        AND NOT EXISTS (
          SELECT 1 FROM archived_projects ap
          WHERE ap.project_id = p.id AND ap.user_id = $2
        )
      ORDER BY p.name ASC
    `;

    const result = await db.query(q, [teamId, userId]);
    const projects = result.rows.map((row: Record<string, unknown>) => {
      const budget = toNumber(row.budget);
      const fixedCost = toNumber(row.fixed_cost);
      const timeBasedCost = toNumber(row.time_based_cost);
      const spent = fixedCost + timeBasedCost;
      const remaining = budget - spent;
      const burnPct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
      const estimatedHours = toNumber(row.estimated_hours);
      const loggedHours = toNumber(row.logged_hours);
      const topLevelLoggedHours = toNumber(row.top_level_logged_hours);
      const remainingHours = Math.max(estimatedHours - topLevelLoggedHours, 0);
      const avgHourlyCost = loggedHours > 0 ? timeBasedCost / loggedHours : 0;
      const etc = calculateEtc({
        budget,
        actual_cost: spent,
        remaining_hours: remainingHours,
        avg_hourly_cost: avgHourlyCost,
        start_date: (row.start_date as string | Date | null) ?? null,
        end_date: (row.end_date as string | Date | null) ?? null,
      });

      return {
        id: row.id,
        name: row.name,
        color_code: row.color_code,
        client_name: row.client_name,
        currency: row.currency || "USD",
        budget,
        spent,
        remaining,
        burn_pct: burnPct,
        etc: Math.round(etc * 100) / 100,
        alert: burnAlert(burnPct, budget > 0),
        estimated_hours: estimatedHours,
        logged_hours: loggedHours,
      };
    });

    return res.status(200).send(new ServerResponse(true, { projects }));
  }

  @HandleExceptions()
  public static async getInvoices(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    if (!teamId) {
      return res.status(400).send(new ServerResponse(false, null, "Missing team context"));
    }

    const { page, pageSize, offset } = parsePagination(req);
    const search = ((req.query.search as string) || "").trim();
    const status = ((req.query.status as string) || "").trim();

    const params: Array<string | number> = [teamId];
    let filterSql = "";
    // "paid" is a payment state now, not a lifecycle status, but the page still filters by it.
    if (status === "paid") {
      filterSql += ` AND i.payment_status = 'paid'`;
    } else if (status) {
      params.push(status);
      filterSql += ` AND i.status = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      filterSql += ` AND (
        i.invoice_no ILIKE $${params.length}
        OR c.name ILIKE $${params.length}
        OR COALESCE(s.name, '') ILIKE $${params.length}
      )`;
    }

    const dataParams = [...params, pageSize, offset];

    const [countResult, result, summaryResult] = await Promise.all([
      db.query(
        `
        SELECT COUNT(*)::INT AS total
        FROM client_portal_invoices i
        LEFT JOIN clients c ON c.id = i.client_id
        LEFT JOIN client_portal_requests r ON r.id = i.request_id
        LEFT JOIN client_portal_services s ON s.id = r.service_id
        WHERE i.organization_team_id = $1
        ${filterSql}
      `,
        params
      ),
      db.query(
        `
        SELECT
          i.id,
          i.invoice_no,
          i.amount::FLOAT AS amount,
          COALESCE(i.currency, 'USD') AS currency,
          i.status,
          i.payment_status,
          i.paid_amount::FLOAT AS paid_amount,
          i.due_date,
          i.sent_at,
          i.paid_at,
          i.created_at,
          c.name AS client_name,
          s.name AS service_name,
          proj.name AS project_name,
          COALESCE(proj.color_code, '#1890ff') AS project_color
        FROM client_portal_invoices i
        LEFT JOIN clients c ON c.id = i.client_id
        LEFT JOIN client_portal_requests r ON r.id = i.request_id
        LEFT JOIN client_portal_services s ON s.id = r.service_id
        LEFT JOIN LATERAL (
          -- client_portal_invoices has no real project link (only client_id),
          -- and a client can have multiple projects — only report a project
          -- name/color when it's unambiguous (exactly one project for this
          -- client), rather than guessing via "most recently updated".
          SELECT
            CASE WHEN COUNT(*) = 1 THEN MIN(p.name) END AS name,
            CASE WHEN COUNT(*) = 1 THEN MIN(p.color_code) END AS color_code
          FROM projects p
          WHERE p.client_id = i.client_id
            AND p.team_id = i.organization_team_id
        ) proj ON TRUE
        WHERE i.organization_team_id = $1
        ${filterSql}
        ORDER BY i.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `,
        dataParams
      ),
      db.query(
        `
        SELECT
          COALESCE(SUM(i.amount), 0)::FLOAT AS total_invoiced,
          COALESCE(SUM(i.paid_amount), 0)::FLOAT AS total_paid,
          COALESCE(SUM(CASE WHEN i.status IN ('sent', 'pending', 'overdue') THEN i.amount - i.paid_amount ELSE 0 END), 0)::FLOAT AS total_outstanding
        FROM client_portal_invoices i
        WHERE i.organization_team_id = $1
          AND i.status <> 'cancelled'
      `,
        [teamId]
      ),
    ]);
    const total = countResult.rows[0]?.total || 0;

    const invoices = result.rows.map((row: Record<string, unknown>) => {
      const amount = toNumber(row.amount);
      const statusValue = String(row.status || "draft");
      const paymentStatusValue = String(row.payment_status || "unpaid");
      // due_date is a plain SQL DATE, returned as a Date at UTC midnight.
      // An invoice isn't overdue until the end of its due date (in UTC, to
      // match how it's stored) — not the instant midnight ticks over, and
      // not via local setHours(), which would shift the cutoff by the
      // server's UTC offset.
      const dueDate = row.due_date ? new Date(row.due_date as string | Date) : null;
      const dueDateEndOfDay = dueDate
        ? new Date(Date.UTC(
            dueDate.getUTCFullYear(),
            dueDate.getUTCMonth(),
            dueDate.getUTCDate(),
            23, 59, 59, 999
          ))
        : null;
      const isOverdue =
        Boolean(dueDateEndOfDay) &&
        dueDateEndOfDay !== null &&
        dueDateEndOfDay < new Date() &&
        paymentStatusValue !== "paid" &&
        statusValue !== "cancelled" &&
        statusValue !== "draft";
      const paymentStatus = paymentStatusValue === "paid"
        ? "paid"
        : isOverdue || statusValue === "overdue"
          ? "overdue"
          : paymentStatusValue === "partially_paid"
            ? "partially_paid"
            : statusValue;

      return {
        id: row.id,
        invoice_no: row.invoice_no,
        client_name: row.client_name,
        project_name: row.project_name || row.service_name || null,
        project_color: row.project_color || "#1890ff",
        amount,
        currency: row.currency || "USD",
        payment_status: paymentStatus,
        paid_amount: toNumber(row.paid_amount),
        status: statusValue,
        issued_at: row.created_at,
        due_date: row.due_date,
      };
    });

    const summary = summaryResult.rows[0] || {};
    return res.status(200).send(new ServerResponse(true, {
      summary: {
        total_invoiced: toNumber(summary.total_invoiced),
        total_paid: toNumber(summary.total_paid),
        total_outstanding: toNumber(summary.total_outstanding),
      },
      invoices,
      total,
      page,
      page_size: pageSize,
    }));
  }

  @HandleExceptions()
  public static async getBillableTime(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const userId = req.user?.id;
    if (!teamId) {
      return res.status(400).send(new ServerResponse(false, null, "Missing team context"));
    }

    const { calcMethod, hoursPerDay } = await getOrgFinanceSettings(teamId);
    const rateSql = buildRateSql(calcMethod, hoursPerDay);

    const range = parseRange(req, "week");
    const { page, pageSize, offset } = parsePagination(req);

    const filters = [teamId, userId, range.start, range.end];

    const fromSql = `
      FROM task_work_log wl
      JOIN tasks t ON t.id = wl.task_id AND t.archived = false
      JOIN projects p ON p.id = t.project_id AND p.team_id = $1
      ${RATE_JOINS}
      LEFT JOIN job_titles jt ON jt.id = tm.job_title_id
      WHERE NOT EXISTS (
        SELECT 1 FROM archived_projects ap
        WHERE ap.project_id = p.id AND ap.user_id = $2
      )
        AND wl.created_at >= $3
        AND wl.created_at <= $4
    `;

    const [summaryResult, countResult, result] = await Promise.all([
      db.query(
        `
        SELECT
          COALESCE(SUM(wl.time_spent), 0)::FLOAT / 3600.0 AS logged_hours,
          COALESCE(SUM(CASE WHEN COALESCE(t.billable, false) THEN wl.time_spent ELSE 0 END), 0)::FLOAT / 3600.0 AS billable_hours,
          COALESCE(SUM(CASE WHEN COALESCE(t.billable, false) THEN 0 ELSE wl.time_spent END), 0)::FLOAT / 3600.0 AS non_billable_hours,
          COALESCE(SUM(
            CASE WHEN COALESCE(t.billable, false)
              THEN (wl.time_spent::FLOAT / 3600.0) * ${rateSql}
              ELSE 0
            END
          ), 0)::FLOAT AS billable_value
        ${fromSql}
      `,
        filters
      ),
      db.query(`SELECT COUNT(DISTINCT wl.id)::INT AS total ${fromSql}`, filters),
      db.query(
        `
        SELECT
          wl.id,
          wl.created_at AS logged_at,
          (COALESCE(wl.time_spent, 0)::FLOAT / 3600.0) AS hours,
          COALESCE(t.billable, false) AS billable,
          ${rateSql} AS rate,
          CASE WHEN COALESCE(t.billable, false)
            THEN (COALESCE(wl.time_spent, 0)::FLOAT / 3600.0) * ${rateSql}
            ELSE 0
          END AS value,
          t.id AS task_id,
          t.name AS task_name,
          p.id AS project_id,
          p.name AS project_name,
          COALESCE(p.color_code, '#1890ff') AS project_color,
          COALESCE(p.currency, 'USD') AS currency,
          u.id AS user_id,
          COALESCE(u.name, '') AS member_name,
          u.avatar_url,
          COALESCE(jt.name, '') AS role_name
        ${fromSql}
        ORDER BY wl.created_at DESC
        LIMIT $5 OFFSET $6
      `,
        [...filters, pageSize, offset]
      ),
    ]);
    const total = countResult.rows[0]?.total || 0;

    const entries = result.rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      logged_at: row.logged_at,
      hours: Math.round(toNumber(row.hours) * 100) / 100,
      billable: Boolean(row.billable),
      rate: toNumber(row.rate),
      value: Math.round(toNumber(row.value) * 100) / 100,
      task_id: row.task_id,
      task_name: row.task_name,
      project_id: row.project_id,
      project_name: row.project_name,
      project_color: row.project_color,
      currency: row.currency || "USD",
      member_name: row.member_name,
      avatar_url: row.avatar_url,
      color_code: getColor(String(row.member_name || "")),
      role_name: row.role_name || null,
    }));

    const summary = summaryResult.rows[0] || {};
    return res.status(200).send(new ServerResponse(true, {
      range: { start: range.start.toISOString(), end: range.end.toISOString() },
      summary: {
        logged_hours: toNumber(summary.logged_hours),
        billable_hours: toNumber(summary.billable_hours),
        non_billable_hours: toNumber(summary.non_billable_hours),
        billable_value: toNumber(summary.billable_value),
      },
      entries,
      total,
      page,
      page_size: pageSize,
    }));
  }

  @HandleExceptions()
  public static async getUtilization(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const userId = req.user?.id;
    if (!teamId) {
      return res.status(400).send(new ServerResponse(false, null, "Missing team context"));
    }

    const range = parseRange(req, "month");

    // orgResult and result (per-member logged time) are independent of each
    // other — only workingDaysResult depends on orgResult's working-days
    // config, so it's kept sequential after this pair.
    const [orgResult, result] = await Promise.all([
      db.query(
        `
        SELECT
          o.id AS organization_id,
          COALESCE(o.hours_per_day, 8)::FLOAT AS hours_per_day,
          COALESCE(owd.monday, true) AS monday,
          COALESCE(owd.tuesday, true) AS tuesday,
          COALESCE(owd.wednesday, true) AS wednesday,
          COALESCE(owd.thursday, true) AS thursday,
          COALESCE(owd.friday, true) AS friday,
          COALESCE(owd.saturday, false) AS saturday,
          COALESCE(owd.sunday, false) AS sunday
        FROM teams t
        JOIN organizations o ON o.id = t.organization_id
        LEFT JOIN organization_working_days owd ON owd.organization_id = o.id
        WHERE t.id = $1
        LIMIT 1
      `,
        [teamId]
      ),
      db.query(
        `
        SELECT
          tm.id AS team_member_id,
          COALESCE(u.name, '') AS member_name,
          u.avatar_url,
          COALESCE(jt.name, '') AS role_name,
          COALESCE(logs.billable_hours, 0)::FLOAT AS billable_hours,
          COALESCE(logs.total_hours, 0)::FLOAT AS total_hours
        FROM team_members tm
        JOIN users u ON u.id = tm.user_id
        LEFT JOIN job_titles jt ON jt.id = tm.job_title_id
        LEFT JOIN (
          SELECT
            wl.user_id,
            SUM(CASE WHEN COALESCE(t.billable, false) THEN wl.time_spent ELSE 0 END)::FLOAT / 3600.0 AS billable_hours,
            SUM(wl.time_spent)::FLOAT / 3600.0 AS total_hours
          FROM task_work_log wl
          JOIN tasks t ON t.id = wl.task_id AND t.archived = false
          JOIN projects p ON p.id = t.project_id AND p.team_id = $1
          WHERE wl.created_at >= $3
            AND wl.created_at <= $4
            AND NOT EXISTS (
              SELECT 1 FROM archived_projects ap
              WHERE ap.project_id = p.id AND ap.user_id = $2
            )
          GROUP BY wl.user_id
        ) logs ON logs.user_id = u.id
        WHERE tm.team_id = $1
          AND tm.active = TRUE
        ORDER BY u.name ASC
      `,
        [teamId, userId, range.start, range.end]
      ),
    ]);

    const org = orgResult.rows[0] || {
      hours_per_day: 8,
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
    };

    const workingDaysResult = await db.query(
      `
        SELECT COUNT(*)::INT AS working_days
        FROM generate_series(($1 AT TIME ZONE 'UTC')::date, ($2 AT TIME ZONE 'UTC')::date, '1 day') AS d(day)
        WHERE CASE EXTRACT(ISODOW FROM d.day)::INT
          WHEN 1 THEN $3::boolean
          WHEN 2 THEN $4::boolean
          WHEN 3 THEN $5::boolean
          WHEN 4 THEN $6::boolean
          WHEN 5 THEN $7::boolean
          WHEN 6 THEN $8::boolean
          WHEN 7 THEN $9::boolean
        END
      `,
      [
        range.start,
        range.end,
        Boolean(org.monday),
        Boolean(org.tuesday),
        Boolean(org.wednesday),
        Boolean(org.thursday),
        Boolean(org.friday),
        Boolean(org.saturday),
        Boolean(org.sunday),
      ]
    );

    const workingDays = workingDaysResult.rows[0]?.working_days || 0;
    const hoursPerDay = toNumber(org.hours_per_day) || 8;
    const capacityHours = workingDays * hoursPerDay;

    const members = result.rows.map((row: Record<string, unknown>) => {
      const billableHours = toNumber(row.billable_hours);
      const totalHours = toNumber(row.total_hours);
      const utilizationPct = capacityHours > 0
        ? Math.round((totalHours / capacityHours) * 100)
        : 0;
      return {
        team_member_id: row.team_member_id,
        member_name: row.member_name,
        avatar_url: row.avatar_url,
        color_code: getColor(String(row.member_name || "")),
        role_name: row.role_name || null,
        billable_hours: Math.round(billableHours * 100) / 100,
        total_hours: Math.round(totalHours * 100) / 100,
        utilization_pct: utilizationPct,
        status: utilizationStatus(utilizationPct),
      };
    });

    const totalBillable = members.reduce((sum, m) => sum + m.billable_hours, 0);
    const totalHours = members.reduce((sum, m) => sum + m.total_hours, 0);
    const teamCapacity = capacityHours * Math.max(members.length, 1);
    const teamUtilization = teamCapacity > 0
      ? Math.round((totalHours / teamCapacity) * 100)
      : 0;

    return res.status(200).send(new ServerResponse(true, {
      range: { start: range.start.toISOString(), end: range.end.toISOString() },
      summary: {
        team_utilization_pct: teamUtilization,
        billable_hours: Math.round(totalBillable * 100) / 100,
        non_billable_hours: Math.round((totalHours - totalBillable) * 100) / 100,
        overallocated_count: members.filter(m => m.utilization_pct > 85).length,
        capacity_hours: capacityHours,
      },
      members,
    }));
  }

  @HandleExceptions()
  public static async getProfitability(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const userId = req.user?.id;
    if (!teamId) {
      return res.status(400).send(new ServerResponse(false, null, "Missing team context"));
    }

    const { calcMethod, hoursPerDay } = await getOrgFinanceSettings(teamId);
    const rateSql = buildRateSql(calcMethod, hoursPerDay);

    const [projectsResult, invoiceSummary, trendResult] = await Promise.all([
      db.query(
        `
        SELECT
          p.id,
          p.name,
          COALESCE(p.color_code, '#1890ff') AS color_code,
          c.name AS client_name,
          COALESCE(p.budget, 0)::FLOAT AS budget,
          COALESCE(p.currency, 'USD') AS currency,
          COALESCE((
            SELECT SUM(COALESCE(t.fixed_cost, 0))
            FROM tasks t WHERE t.project_id = p.id AND t.archived = false
          ), 0)::FLOAT AS fixed_cost,
          COALESCE((
            SELECT SUM((COALESCE(wl.time_spent, 0)::FLOAT / 3600.0) * ${rateSql})
            FROM tasks t
            JOIN task_work_log wl ON wl.task_id = t.id
            ${RATE_JOINS}
            WHERE t.project_id = p.id AND t.archived = false
          ), 0)::FLOAT AS time_based_cost,
          COALESCE((
            SELECT SUM(COALESCE(wl.time_spent, 0))::FLOAT / 3600.0
            FROM tasks t
            JOIN task_work_log wl ON wl.task_id = t.id
            WHERE t.project_id = p.id AND t.archived = false
          ), 0)::FLOAT AS logged_hours,
          COALESCE((
            SELECT SUM(CASE WHEN COALESCE(t.billable, false) THEN COALESCE(wl.time_spent, 0) ELSE 0 END)::FLOAT / 3600.0
            FROM tasks t
            JOIN task_work_log wl ON wl.task_id = t.id
            WHERE t.project_id = p.id AND t.archived = false
          ), 0)::FLOAT AS billable_hours
        FROM projects p
        LEFT JOIN clients c ON c.id = p.client_id
        WHERE p.team_id = $1
          AND NOT EXISTS (
            SELECT 1 FROM archived_projects ap
            WHERE ap.project_id = p.id AND ap.user_id = $2
          )
        ORDER BY p.name ASC
      `,
        [teamId, userId]
      ),
      db.query(
        `
        SELECT
          COALESCE(SUM(i.paid_amount), 0)::FLOAT AS paid_revenue,
          COALESCE(SUM(CASE WHEN i.status IN ('sent', 'pending', 'paid', 'overdue') THEN i.amount ELSE 0 END), 0)::FLOAT AS invoiced_revenue
        FROM client_portal_invoices i
        WHERE i.organization_team_id = $1
          AND i.status <> 'cancelled'
      `,
        [teamId]
      ),
      db.query(
        `
        WITH months AS (
          SELECT generate_series(
            date_trunc('month', CURRENT_DATE) - INTERVAL '5 months',
            date_trunc('month', CURRENT_DATE),
            '1 month'
          )::date AS month_start
        )
        SELECT
          to_char(m.month_start, 'YYYY-MM') AS month_key,
          to_char(m.month_start, 'Mon YYYY') AS month_label,
          COALESCE((
            SELECT SUM(i.amount)
            FROM client_portal_invoices i
            WHERE i.organization_team_id = $1
              AND i.status IN ('sent', 'pending', 'paid', 'overdue')
              AND date_trunc('month', i.created_at) = m.month_start
          ), 0)::FLOAT AS revenue,
          COALESCE((
            SELECT SUM((COALESCE(wl.time_spent, 0)::FLOAT / 3600.0) * ${rateSql})
            FROM task_work_log wl
            JOIN tasks t ON t.id = wl.task_id AND t.archived = false
            JOIN projects p ON p.id = t.project_id AND p.team_id = $1
            ${RATE_JOINS}
            WHERE date_trunc('month', wl.created_at) = m.month_start
              AND NOT EXISTS (
                SELECT 1 FROM archived_projects ap
                WHERE ap.project_id = p.id AND ap.user_id = $2
              )
          ), 0)::FLOAT AS time_based_cost
        FROM months m
        ORDER BY m.month_start
      `,
        [teamId, userId]
      ),
    ]);

    const projects = projectsResult.rows.map((row: Record<string, unknown>) => {
      const cost = toNumber(row.fixed_cost) + toNumber(row.time_based_cost);
      const loggedHours = toNumber(row.logged_hours);
      const billableHours = toNumber(row.billable_hours);
      const utilizationPct = loggedHours > 0
        ? Math.round((billableHours / loggedHours) * 100)
        : 0;
      const budget = toNumber(row.budget);
      const burnPct = budget > 0 ? Math.round((cost / budget) * 100) : 0;
      return {
        id: row.id,
        name: row.name,
        color_code: row.color_code,
        client_name: row.client_name,
        currency: row.currency || "USD",
        cost,
        fixed_cost: toNumber(row.fixed_cost),
        time_based_cost: toNumber(row.time_based_cost),
        utilization_pct: utilizationPct,
        health: burnAlert(burnPct, budget > 0),
      };
    });

    const trackedCost = projects.reduce((sum, p) => sum + p.cost, 0);
    const fixedCost = projects.reduce((sum, p) => sum + p.fixed_cost, 0);
    const timeBasedCost = projects.reduce((sum, p) => sum + p.time_based_cost, 0);
    const totalHours = projectsResult.rows.reduce(
      (sum: number, row: Record<string, unknown>) => sum + toNumber(row.logged_hours),
      0
    );
    const billableHours = projectsResult.rows.reduce(
      (sum: number, row: Record<string, unknown>) => sum + toNumber(row.billable_hours),
      0
    );
    const revenue = toNumber(invoiceSummary.rows[0]?.paid_revenue);
    const profit = revenue - trackedCost;
    const margin = revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0;
    const billableUtil = totalHours > 0 ? Math.round((billableHours / totalHours) * 100) : 0;

    return res.status(200).send(new ServerResponse(true, {
      summary: {
        revenue,
        invoiced_revenue: toNumber(invoiceSummary.rows[0]?.invoiced_revenue),
        tracked_cost: trackedCost,
        profit,
        profit_margin_pct: margin,
        billable_utilization_pct: billableUtil,
        has_revenue: revenue > 0 || toNumber(invoiceSummary.rows[0]?.invoiced_revenue) > 0,
      },
      cost_breakdown: [
        { key: "fixed", amount: fixedCost },
        { key: "timeBased", amount: timeBasedCost },
      ],
      trend: trendResult.rows.map((row: Record<string, unknown>) => ({
        month_key: row.month_key,
        month_label: row.month_label,
        revenue: toNumber(row.revenue),
        cost: toNumber(row.time_based_cost),
        profit: toNumber(row.revenue) - toNumber(row.time_based_cost),
      })),
      projects,
    }));
  }

  @HandleExceptions()
  public static async getForecasts(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const userId = req.user?.id;
    if (!teamId) {
      return res.status(400).send(new ServerResponse(false, null, "Missing team context"));
    }

    const { calcMethod, hoursPerDay } = await getOrgFinanceSettings(teamId);
    const rateSql = buildRateSql(calcMethod, hoursPerDay);

    const historyResult = await db.query(
      `
        WITH months AS (
          SELECT generate_series(
            date_trunc('month', CURRENT_DATE) - INTERVAL '2 months',
            date_trunc('month', CURRENT_DATE),
            '1 month'
          )::date AS month_start
        )
        SELECT
          to_char(m.month_start, 'YYYY-MM') AS month_key,
          to_char(m.month_start, 'Mon YYYY') AS month_label,
          m.month_start,
          COALESCE((
            SELECT SUM(i.amount)
            FROM client_portal_invoices i
            WHERE i.organization_team_id = $1
              AND i.status IN ('sent', 'pending', 'paid', 'overdue')
              AND date_trunc('month', i.created_at) = m.month_start
          ), 0)::FLOAT AS revenue,
          COALESCE((
            SELECT SUM((COALESCE(wl.time_spent, 0)::FLOAT / 3600.0) * ${rateSql})
            FROM task_work_log wl
            JOIN tasks t ON t.id = wl.task_id AND t.archived = false
            JOIN projects p ON p.id = t.project_id AND p.team_id = $1
            ${RATE_JOINS}
            WHERE date_trunc('month', wl.created_at) = m.month_start
              AND NOT EXISTS (
                SELECT 1 FROM archived_projects ap
                WHERE ap.project_id = p.id AND ap.user_id = $2
              )
          ), 0)::FLOAT AS cost
        FROM months m
        ORDER BY m.month_start
      `,
      [teamId, userId]
    );

    const history = historyResult.rows.map((row: Record<string, unknown>) => ({
      month_key: String(row.month_key),
      month_label: String(row.month_label),
      revenue: toNumber(row.revenue),
      cost: toNumber(row.cost),
      profit: toNumber(row.revenue) - toNumber(row.cost),
      projected: false,
    }));

    const revenueForecast = linearNext(history.map(h => h.revenue), 3);
    const costForecast = linearNext(history.map(h => h.cost), 3);
    // Build the anchor month from its parsed year/month components rather than
    // `new Date("YYYY-MM-01")`, which parses as UTC midnight while addMonths/
    // monthKey/monthLabel read it back with local-timezone getters — on a
    // server running behind UTC, that mismatch shifts every projected month
    // back by one.
    const lastMonth = history.length
      ? (() => {
          const [year, month] = history[history.length - 1].month_key.split("-").map(Number);
          return new Date(year, month - 1, 1);
        })()
      : new Date();

    const projected = revenueForecast.map((revenue, index) => {
      const date = addMonths(lastMonth, index + 1);
      const cost = costForecast[index];
      return {
        month_key: monthKey(date),
        month_label: monthLabel(date),
        revenue: Math.round(revenue * 100) / 100,
        cost: Math.round(cost * 100) / 100,
        profit: Math.round((revenue - cost) * 100) / 100,
        projected: true,
      };
    });

    const thisMonth = projected[0] || { revenue: 0, profit: 0, cost: 0 };
    const lastActual = history[history.length - 1] || { revenue: 0, profit: 0 };

    return res.status(200).send(new ServerResponse(true, {
      methodology: "linear_trend",
      summary: {
        projected_revenue: thisMonth.revenue,
        projected_profit: thisMonth.profit,
        // null (rather than 0) when there's no meaningful baseline to compare
        // against, so a genuine jump from $0 isn't rendered as "flat".
        revenue_delta_pct: lastActual.revenue > 0
          ? Math.round(((thisMonth.revenue - lastActual.revenue) / lastActual.revenue) * 1000) / 10
          : null,
        profit_delta_pct: lastActual.profit !== 0
          ? Math.round(((thisMonth.profit - lastActual.profit) / Math.abs(lastActual.profit)) * 1000) / 10
          : null,
        has_revenue: history.some(h => h.revenue > 0) || projected.some(p => p.revenue > 0),
      },
      chart: [...history, ...projected],
    }));
  }
}
