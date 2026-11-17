import moment from "moment";
import Excel from "exceljs";

import db from "../../config/db";
import HandleExceptions from "../../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { buildOrganizationReportScope } from "./organization-report-scope";
import ReportingControllerBase from "./reporting-controller-base";

interface IMonthEndBreakdownRow {
  id: string | null;
  name: string;
  color_code?: string | null;
  tasks_completed: number;
  estimated_seconds: number;
  logged_seconds: number;
  efficiency_percent: number | null;
}

interface IMonthEndSummary {
  month: string;
  hours_per_day: number;
  logged_hours: number;          // all time logged in the month, across scope
  tasks_completed: number;       // tasks marked done with completed_at in the month
  budget_man_days: number;       // estimated effort of completed-this-month tasks
  actual_man_days: number;       // actual effort spent delivering those completed tasks
  variance_man_days: number;     // budget - actual
  efficiency_percent: number | null; // budget / actual * 100
  members: IMonthEndBreakdownRow[];
  projects: IMonthEndBreakdownRow[];
}

export default class ReportingMonthEndController extends ReportingControllerBase {
  /**
   * Build the "in scope" filter. Priority: projects -> teams -> caller's organization.
   */
  private static buildScopeClause(
    req: IWorkLenzRequest,
    paramOffset: number
  ): { clause: string; params: any[] } {
    return buildOrganizationReportScope(
      this.getCurrentTeamId(req), req.body.teams || [], req.body.projects || [], paramOffset
    );
  }

  /**
   * Common CTE selecting tasks completed (status is_done + completed_at) within the month, in scope.
   * Bound params: $1 = month start, $2 = month end, then scope params, then archived params.
   */
  private static completedTasksCte(scopeClause: string, archivedClause: string): string {
    return `
      done_category AS (
        SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE
      ),
      completed_tasks AS (
        SELECT t.id,
               t.total_minutes,
               p.id AS project_id,
               p.name AS project_name,
               p.color_code,
               p.team_id
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        JOIN task_statuses ts ON ts.id = t.status_id
        WHERE t.completed_at IS NOT NULL
          AND t.completed_at::DATE >= $1::DATE
          AND t.completed_at::DATE <= $2::DATE
          AND ts.category_id IN (SELECT id FROM done_category)
          ${scopeClause} ${archivedClause}
      )`;
  }

  private static efficiency(estimated: number, logged: number): number | null {
    return logged > 0 ? +((estimated / logged) * 100).toFixed(1) : null;
  }

  private static async buildSummary(req: IWorkLenzRequest): Promise<IMonthEndSummary> {
    const month = String(req.body.month || moment().format("YYYY-MM"));
    const archived = req.body.archived === true || req.query.archived === "true";

    const start = moment(month, "YYYY-MM").startOf("month").format("YYYY-MM-DD");
    const end = moment(month, "YYYY-MM").endOf("month").format("YYYY-MM-DD");

    // hours_per_day from the caller's organization, used to convert seconds -> man days.
    const orgRes = await db.query(
      `SELECT o.hours_per_day
       FROM teams t JOIN organizations o ON o.id = t.organization_id
       WHERE t.id = $1`,
      [this.getCurrentTeamId(req)]
    );
    const hoursPerDay = Number(orgRes.rows[0]?.hours_per_day) || 8;
    const secondsPerDay = hoursPerDay * 3600;

    // Scope + archived clauses start at $3 ($1/$2 are the month bounds).
    let paramOffset = 3;
    const { clause: scopeClause, params: scopeParams } = this.buildScopeClause(req, paramOffset);
    paramOffset += scopeParams.length;
    const { clause: archivedClause, params: archivedParams } =
      await this.getArchivedProjectsClause(archived, req.user?.id || "", "p.id", paramOffset);

    const baseParams = [start, end, ...scopeParams, ...archivedParams];

    // 1) Total hours logged in the month (all activity in scope, not only completed tasks).
    const loggedRes = await db.query(
      `SELECT COALESCE(SUM(task_work_log.time_spent), 0) AS logged_seconds
       FROM task_work_log
       JOIN tasks t ON t.id = task_work_log.task_id
       JOIN projects p ON p.id = t.project_id
       WHERE task_work_log.created_at::DATE >= $1::DATE
         AND task_work_log.created_at::DATE <= $2::DATE
         ${scopeClause} ${archivedClause}`,
      baseParams
    );
    const loggedHours = +((Number(loggedRes.rows[0]?.logged_seconds) || 0) / 3600).toFixed(2);

    // 2) Headline budget vs actual for work delivered this month.
    const summaryRes = await db.query(
      `WITH ${this.completedTasksCte(scopeClause, archivedClause)},
       completed_logged AS (
         SELECT COALESCE(SUM(task_work_log.time_spent), 0) AS logged_seconds
         FROM task_work_log
         WHERE task_work_log.task_id IN (SELECT id FROM completed_tasks)
       )
       SELECT
         (SELECT COUNT(*) FROM completed_tasks) AS tasks_completed,
         COALESCE((SELECT SUM(total_minutes * 60) FROM completed_tasks), 0) AS estimated_seconds,
         (SELECT logged_seconds FROM completed_logged) AS actual_seconds`,
      baseParams
    );
    const summaryRow = summaryRes.rows[0] || {};
    const estimatedSeconds = Number(summaryRow.estimated_seconds) || 0;
    const actualSeconds = Number(summaryRow.actual_seconds) || 0;

    // 3) Member breakdown (completed tasks this month).
    const membersRes = await db.query(
      `WITH ${this.completedTasksCte(scopeClause, archivedClause)},
       task_assignee_counts AS (
         SELECT task_id, COUNT(*) AS assignee_count
         FROM tasks_assignees
         WHERE task_id IN (SELECT id FROM completed_tasks)
         GROUP BY task_id
       ),
       mem_est AS (
         -- Split each completed task's estimate evenly across its assignees.
         SELECT ta.team_member_id AS tmid,
                SUM((ct.total_minutes * 60.0) / NULLIF(tac.assignee_count, 0)) AS estimated_seconds,
                COUNT(DISTINCT ct.id) AS tasks_completed
         FROM completed_tasks ct
         JOIN tasks_assignees ta ON ta.task_id = ct.id
         JOIN task_assignee_counts tac ON tac.task_id = ct.id
         GROUP BY ta.team_member_id
       ),
       mem_log AS (
         SELECT tm.id AS tmid, SUM(task_work_log.time_spent) AS logged_seconds
         FROM task_work_log
         JOIN completed_tasks ct ON ct.id = task_work_log.task_id
         JOIN team_members tm ON tm.user_id = task_work_log.user_id AND tm.team_id = ct.team_id
         GROUP BY tm.id
       )
       SELECT COALESCE(me.tmid, ml.tmid) AS id,
              tmiv.name,
              COALESCE(me.tasks_completed, 0) AS tasks_completed,
              COALESCE(me.estimated_seconds, 0) AS estimated_seconds,
              COALESCE(ml.logged_seconds, 0) AS logged_seconds
       FROM mem_est me
       FULL OUTER JOIN mem_log ml ON ml.tmid = me.tmid
       LEFT JOIN team_member_info_view tmiv ON tmiv.team_member_id = COALESCE(me.tmid, ml.tmid)
       WHERE COALESCE(me.tmid, ml.tmid) IS NOT NULL
       ORDER BY logged_seconds DESC`,
      baseParams
    );

    // 4) Project breakdown (completed tasks this month).
    const projectsRes = await db.query(
      `WITH ${this.completedTasksCte(scopeClause, archivedClause)},
       task_log AS (
         SELECT task_work_log.task_id, SUM(task_work_log.time_spent) AS logged_seconds
         FROM task_work_log
         JOIN completed_tasks ct ON ct.id = task_work_log.task_id
         GROUP BY task_work_log.task_id
       )
       SELECT ct.project_id AS id,
              ct.project_name AS name,
              ct.color_code,
              COUNT(DISTINCT ct.id) AS tasks_completed,
              COALESCE(SUM(ct.total_minutes * 60), 0) AS estimated_seconds,
              COALESCE(SUM(tl.logged_seconds), 0) AS logged_seconds
       FROM completed_tasks ct
       LEFT JOIN task_log tl ON tl.task_id = ct.id
       GROUP BY ct.project_id, ct.project_name, ct.color_code
       ORDER BY logged_seconds DESC`,
      baseParams
    );

    const toBreakdown = (r: any): IMonthEndBreakdownRow => {
      const est = Number(r.estimated_seconds) || 0;
      const log = Number(r.logged_seconds) || 0;
      return {
        id: r.id ?? null,
        name: r.name || "Untitled",
        color_code: r.color_code ?? null,
        tasks_completed: Number(r.tasks_completed) || 0,
        estimated_seconds: est,
        logged_seconds: log,
        efficiency_percent: this.efficiency(est, log)
      };
    };

    const budgetManDays = +(estimatedSeconds / secondsPerDay).toFixed(2);
    const actualManDays = +(actualSeconds / secondsPerDay).toFixed(2);

    return {
      month,
      hours_per_day: hoursPerDay,
      logged_hours: loggedHours,
      tasks_completed: Number(summaryRow.tasks_completed) || 0,
      budget_man_days: budgetManDays,
      actual_man_days: actualManDays,
      variance_man_days: +(budgetManDays - actualManDays).toFixed(2),
      efficiency_percent: this.efficiency(estimatedSeconds, actualSeconds),
      members: membersRes.rows.map(toBreakdown),
      projects: projectsRes.rows.map(toBreakdown)
    };
  }

  @HandleExceptions()
  public static async getMonthEndSummary(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const summary = await this.buildSummary(req);
    return res.status(200).send(new ServerResponse(true, summary));
  }

  @HandleExceptions()
  public static async exportExcel(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<void> {
    // POST export: filters arrive in the request body (same shape as getMonthEndSummary).
    const summary = await this.buildSummary(req);
    const fileName = `Month-End Summary - ${summary.month}`;

    const workbook = new Excel.Workbook();
    const headerFill: any = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };

    // Summary sheet
    const summarySheet = workbook.addWorksheet("Summary");
    summarySheet.columns = [
      { header: "Metric", key: "metric", width: 30 },
      { header: "Value", key: "value", width: 24 }
    ];
    summarySheet.getRow(1).font = { bold: true };
    summarySheet.getRow(1).fill = headerFill;
    summarySheet.addRows([
      { metric: "Month", value: summary.month },
      { metric: "Hours per day", value: summary.hours_per_day },
      { metric: "Logged hours", value: summary.logged_hours },
      { metric: "Tasks completed", value: summary.tasks_completed },
      { metric: "Budget (man days)", value: summary.budget_man_days },
      { metric: "Actual (man days)", value: summary.actual_man_days },
      { metric: "Variance (man days)", value: summary.variance_man_days },
      { metric: "Efficiency %", value: summary.efficiency_percent === null ? "-" : `${summary.efficiency_percent}%` }
    ]);

    const breakdownColumns = [
      { header: "Name", key: "name", width: 36 },
      { header: "Tasks Completed", key: "tasks_completed", width: 18 },
      { header: "Estimated", key: "estimated", width: 18 },
      { header: "Logged", key: "logged", width: 18 },
      { header: "Efficiency %", key: "efficiency", width: 16 }
    ];

    const addBreakdownSheet = (title: string, rows: IMonthEndBreakdownRow[]) => {
      const sheet = workbook.addWorksheet(title);
      sheet.columns = breakdownColumns;
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = headerFill;
      for (const row of rows) {
        sheet.addRow({
          name: row.name,
          tasks_completed: row.tasks_completed,
          estimated: this.convertSecondsToHoursAndMinutes(row.estimated_seconds),
          logged: this.convertSecondsToHoursAndMinutes(row.logged_seconds),
          efficiency: row.efficiency_percent === null ? "-" : `${row.efficiency_percent}%`
        });
      }
    };

    addBreakdownSheet("Members", summary.members);
    addBreakdownSheet("Projects", summary.projects);

    res.setHeader("Content-Type", "application/vnd.openxmlformats");
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  }
}
