import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import { getColor } from "../shared/utils";
import { buildRateSql } from "../shared/finance-rate";
import Excel from "exceljs";

// Org-level finance settings. $1 = team id.
const ORG_FINANCE_SETTINGS_SQL = `
  SELECT o.calculation_method, o.hours_per_day
  FROM teams t
  JOIN organizations o ON t.organization_id = o.id
  WHERE t.id = $1
`;

export async function getOrgFinanceSettings(
  teamId: string
): Promise<{ calcMethod: string; hoursPerDay: number }> {
  const orgResult = await db.query(ORG_FINANCE_SETTINGS_SQL, [teamId]);
  return {
    calcMethod: orgResult.rows[0]?.calculation_method || "hourly",
    hoursPerDay: Number(orgResult.rows[0]?.hours_per_day) || 8,
  };
}

/**
 * Per-project portfolio finance rollup — one row per non-archived project in the
 * team. Shared verbatim by getPortfolioFinance and its Excel export so the two
 * can never drift.
 *
 * Params: $1 = team id, $2 = user id (archived-projects filter).
 * calcMethod/hoursPerDay are embedded via buildRateSql (shared/finance-rate.ts)
 * rather than bound as query params — see that module for why.
 *
 * time_based_cost mirrors the per-project Finance tab exactly
 * (project-finance-controller.ts): task_work_log -> users -> team_members
 * (scoped to the project's team) -> project_members -> assigned rate card role,
 * honoring the man_days calculation method. Keep in sync with that controller.
 */
const buildPortfolioFinanceSql = (calcMethod: string, hoursPerDay: number): string => `
  SELECT
    p.id,
    p.name,
    COALESCE(p.color_code, '#1890ff')   AS color_code,
    c.name                               AS client_name,
    COALESCE(p.budget, 0)::FLOAT         AS budget,
    COALESCE(p.currency, 'USD')          AS currency,

    -- Fixed cost: sum of task-level fixed costs (non-time costs)
    COALESCE(
      (
        SELECT SUM(COALESCE(t.fixed_cost, 0))
        FROM tasks t
        WHERE t.project_id = p.id
          AND t.archived = false
      ), 0
    )::FLOAT AS fixed_cost,

    -- Time-based cost: actual cost from logged hours × member rate.
    COALESCE(
      (
        SELECT SUM(
          (wl.time_spent / 3600.0) * ${buildRateSql(calcMethod, hoursPerDay)}
        )
        FROM tasks t
        JOIN task_work_log wl ON wl.task_id = t.id
        LEFT JOIN users u ON wl.user_id = u.id
        LEFT JOIN team_members tm
          ON tm.user_id = u.id
         AND tm.team_id = p.team_id
        LEFT JOIN project_members pm
          ON pm.team_member_id = tm.id
         AND pm.project_id = t.project_id
        LEFT JOIN finance_project_rate_card_roles fprr
          ON fprr.id = pm.project_rate_card_role_id
        WHERE t.project_id = p.id
          AND t.archived = false
      ), 0
    )::FLOAT AS time_based_cost,

    -- Estimated hours: sum of task time estimates (top-level tasks only)
    COALESCE(
      (
        SELECT SUM(COALESCE(t.total_minutes, 0))::FLOAT / 60.0
        FROM tasks t
        WHERE t.project_id = p.id
          AND t.archived = false
          AND t.parent_task_id IS NULL
      ), 0
    )::FLOAT AS estimated_hours

  FROM projects p
  LEFT JOIN clients c ON c.id = p.client_id
  WHERE p.team_id = $1
    AND NOT EXISTS (
      SELECT 1 FROM archived_projects ap
      WHERE ap.project_id = p.id
        AND ap.user_id = $2
    )
  ORDER BY p.name ASC;
`;

export default class FinanceOverviewController extends WorklenzControllerBase {

  @HandleExceptions()
  public static async getPortfolioFinance(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const userId = req.user?.id;

    if (!teamId) {
      return res.status(400).send(new ServerResponse(false, null, "Missing team context"));
    }

    // Resolve the organization's finance calculation method so the Overview
    // reconciles exactly with the per-project Finance tab.
    const { calcMethod, hoursPerDay } = await getOrgFinanceSettings(teamId);

    const result = await db.query(buildPortfolioFinanceSql(calcMethod, hoursPerDay), [teamId, userId]);

    // Compute actual_cost on the backend so the frontend never has to
    const projects = result.rows.map((row: any) => ({
      ...row,
      actual_cost: (row.fixed_cost ?? 0) + (row.time_based_cost ?? 0),
    }));

    return res.status(200).send(new ServerResponse(true, { projects }));
  }

  @HandleExceptions()
  public static async exportPortfolioFinance(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const userId = req.user?.id;
    if (!teamId) {
      return res.status(400).send(new ServerResponse(false, null, "Missing team context"));
    }

    // Same rollup as getPortfolioFinance so the export matches the table exactly.
    const { calcMethod, hoursPerDay } = await getOrgFinanceSettings(teamId);

    const result = await db.query(buildPortfolioFinanceSql(calcMethod, hoursPerDay), [teamId, userId]);

    const workbook = new Excel.Workbook();
    const sheet = workbook.addWorksheet("Finance Overview");

    sheet.columns = [
      { header: "Project", key: "name", width: 30 },
      { header: "Client", key: "client_name", width: 20 },
      { header: "Manual Budget", key: "budget", width: 18 },
      { header: "Actual Cost", key: "actual_cost", width: 18 },
      { header: "Variance", key: "variance", width: 18 },
      { header: "Budget Utilization %", key: "utilization", width: 22 },
      { header: "Est. Hours", key: "estimated_hours", width: 15 },
      { header: "Currency", key: "currency", width: 10 },
    ];

    // Style header row
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: "pattern", pattern: "solid",
      fgColor: { argb: "FFE6F4FF" },
    };

    result.rows.forEach((row: any) => {
      const actual = (row.fixed_cost ?? 0) + (row.time_based_cost ?? 0);
      const variance = (row.budget ?? 0) - actual;
      const utilization = row.budget > 0
        ? Math.round((actual / row.budget) * 100)
        : 0;

      sheet.addRow({
        name: row.name,
        client_name: row.client_name ?? "",
        budget: row.budget,
        actual_cost: actual,
        variance: variance,
        utilization: utilization,
        estimated_hours: Math.round(row.estimated_hours ?? 0),
        currency: row.currency,
      });
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="finance-overview-${new Date().toISOString().split("T")[0]}.xlsx"`);

    await workbook.xlsx.write(res);
    return res.end();
  }

  @HandleExceptions()
  public static async getTeamFixedCosts(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const userId = req.user?.id;

    if (!teamId) {
      return res.status(400).send(new ServerResponse(false, null, "Missing team context"));
    }

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.page_size as string, 10) || 10));
    const offset = (page - 1) * pageSize;

    /**
     * One row per task that currently has a fixed cost set, across every
     * project in the active team. tasks.fixed_cost has no per-entry ledger
     * (see updateTaskFixedCost in project-finance-controller.ts) — it's a
     * single running total per task — so this lists each task's current
     * fixed cost, not a history of individual additions. updated_at is the
     * task's generic last-modified timestamp (also touched by unrelated
     * edits), used here as the best available "last updated" proxy.
     */
    const countQuery = `
      SELECT COUNT(*)::INT AS total
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      WHERE p.team_id = $1
        AND t.archived = false
        AND COALESCE(t.fixed_cost, 0) > 0
        AND NOT EXISTS (
          SELECT 1 FROM archived_projects ap
          WHERE ap.project_id = p.id AND ap.user_id = $2
        )
    `;
    const countResult = await db.query(countQuery, [teamId, userId]);
    const total = countResult.rows[0]?.total || 0;

    const dataQuery = `
      SELECT
        t.id AS task_id,
        t.name AS task_name,
        COALESCE(t.fixed_cost, 0)::FLOAT AS fixed_cost,
        t.updated_at,
        p.id AS project_id,
        p.name AS project_name,
        COALESCE(p.color_code, '#1890ff') AS project_color,
        COALESCE(p.currency, 'USD') AS currency,
        (SELECT get_task_assignees(t.id)) AS assignees
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      WHERE p.team_id = $1
        AND t.archived = false
        AND COALESCE(t.fixed_cost, 0) > 0
        AND NOT EXISTS (
          SELECT 1 FROM archived_projects ap
          WHERE ap.project_id = p.id AND ap.user_id = $2
        )
      ORDER BY t.updated_at DESC NULLS LAST
      LIMIT $3 OFFSET $4
    `;
    const result = await db.query(dataQuery, [teamId, userId, pageSize, offset]);

    const items = result.rows.map((row: any) => ({
      task_id: row.task_id,
      task_name: row.task_name,
      fixed_cost: Number(row.fixed_cost) || 0,
      updated_at: row.updated_at,
      project_id: row.project_id,
      project_name: row.project_name,
      project_color: row.project_color,
      currency: row.currency || "USD",
      // get_task_assignees() returns raw assignee rows with no color — every
      // other task-list-producing controller (tasks-controller-base.ts,
      // team-members-controller.ts) derives the avatar color from the
      // member's name the same way, so mirror that here instead of letting
      // the frontend fall back to plain gray.
      assignees: (row.assignees || []).map((assignee: any) => ({
        ...assignee,
        color_code: getColor(assignee.name),
      })),
    }));

    return res.status(200).send(new ServerResponse(true, {
      items,
      total,
      page,
      page_size: pageSize,
    }));
  }

}
