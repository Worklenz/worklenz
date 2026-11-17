import moment from "moment";
import Excel from "exceljs";

import db from "../../config/db";
import HandleExceptions from "../../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { DATE_RANGES } from "../../shared/constants";
import { buildOrganizationReportScope } from "./organization-report-scope";
import ReportingControllerBase from "./reporting-controller-base";

type EfficiencyLevel = "member" | "team" | "project" | "company";

interface IEfficiencyRow {
  group_id: string | null;
  group_name: string;
  color_code?: string | null;
  estimated_seconds: number;
  logged_seconds: number;
  estimated_string: string;
  logged_string: string;
  efficiency_percent: number | null;
}

export default class ReportingEfficiencyController extends ReportingControllerBase {
  private static readonly VALID_LEVELS: EfficiencyLevel[] = ["member", "team", "project", "company"];

  /**
   * Build the "in scope" filter clause for tasks/projects from the request body.
   * Priority: explicit projects -> explicit teams -> whole organization of the caller.
   * Returns the clause plus its bound params (starting at `paramOffset`).
   */
  private static buildScopeClause(
    req: IWorkLenzRequest,
    level: EfficiencyLevel,
    paramOffset: number
  ): { clause: string; params: any[] } {
    return buildOrganizationReportScope(
      this.getCurrentTeamId(req), req.body.teams || [], req.body.projects || [], paramOffset, level === "company"
    );
  }

  private static toRow(raw: any): IEfficiencyRow {
    const estimated = Number(raw.estimated_seconds) || 0;
    const logged = Number(raw.logged_seconds) || 0;
    return {
      group_id: raw.group_id ?? null,
      group_name: raw.group_name || "Untitled",
      color_code: raw.color_code ?? null,
      estimated_seconds: estimated,
      logged_seconds: logged,
      estimated_string: this.convertSecondsToHoursAndMinutes(estimated),
      logged_string: this.convertSecondsToHoursAndMinutes(logged),
      // Efficiency = logged / estimated * 100. 100% = on budget, <100% = under budget, >100% = over budget.
      // Undefined when there is no estimate to compare against.
      efficiency_percent: estimated > 0 ? +((logged / estimated) * 100).toFixed(1) : null
    };
  }

  private static async fetchEfficiency(req: IWorkLenzRequest): Promise<IEfficiencyRow[]> {
    const level = (req.body.level || "project") as EfficiencyLevel;
    const archived = req.body.archived === true || req.query.archived === "true";
    const { duration, date_range } = req.body;

    // Scope params come first, then archived, then duration (order matches SQL text below).
    let paramOffset = 1;
    const { clause: scopeClause, params: scopeParams } = this.buildScopeClause(req, level, paramOffset);
    paramOffset += scopeParams.length;

    const { clause: archivedClause, params: archivedParams } =
      await this.getArchivedProjectsClause(archived, req.user?.id || "", "p.id", paramOffset);
    paramOffset += archivedParams.length;

    const { clause: durationClause, params: durationParams } =
      this.getDateRangeClause(duration || DATE_RANGES.LAST_MONTH, date_range, paramOffset);

    if (level === "member") {
      const q = `
        WITH scoped_tasks AS (
          SELECT t.id, t.total_minutes, p.team_id AS project_team_id
          FROM tasks t
          JOIN projects p ON p.id = t.project_id
          WHERE TRUE ${scopeClause} ${archivedClause}
        ),
        -- Tasks that actually have logs in the selected date range.
        -- Used to align estimate scope with log scope so we compare
        -- the same body of work on both sides of the calculation.
        tasks_with_logs AS (
          SELECT DISTINCT task_id
          FROM task_work_log
          WHERE task_id IN (SELECT id FROM scoped_tasks)
          AND TRUE ${durationClause}
        ),
        task_assignee_counts AS (
          SELECT task_id, COUNT(*) AS assignee_count
          FROM tasks_assignees
          WHERE task_id IN (SELECT task_id FROM tasks_with_logs)
          GROUP BY task_id
        ),
        member_estimated AS (
          -- Split each task's estimate evenly across its assignees.
          -- Only tasks that were logged in the period are considered so that
          -- the estimate denominator matches the log numerator.
          SELECT ta.team_member_id AS tmid,
                 SUM((st.total_minutes * 60.0) / NULLIF(tac.assignee_count, 0)) AS estimated_seconds
          FROM scoped_tasks st
          JOIN tasks_with_logs twl ON twl.task_id = st.id
          JOIN tasks_assignees ta ON ta.task_id = st.id
          JOIN task_assignee_counts tac ON tac.task_id = st.id
          GROUP BY ta.team_member_id
        ),
        member_logged AS (
          -- Restrict team_members to the team that owns the scoped project so that
          -- users who belong to multiple teams are not counted more than once.
          SELECT tm.id AS tmid, SUM(task_work_log.time_spent) AS logged_seconds
          FROM task_work_log
          JOIN scoped_tasks st ON st.id = task_work_log.task_id
          JOIN team_members tm ON tm.user_id = task_work_log.user_id
            AND tm.team_id = st.project_team_id
          WHERE TRUE ${durationClause}
          GROUP BY tm.id
        )
        SELECT COALESCE(me.tmid, ml.tmid) AS group_id,
               tmiv.name AS group_name,
               COALESCE(me.estimated_seconds, 0) AS estimated_seconds,
               COALESCE(ml.logged_seconds, 0) AS logged_seconds
        FROM member_estimated me
        FULL OUTER JOIN member_logged ml ON ml.tmid = me.tmid
        LEFT JOIN team_member_info_view tmiv ON tmiv.team_member_id = COALESCE(me.tmid, ml.tmid)
        WHERE COALESCE(me.tmid, ml.tmid) IS NOT NULL
        ORDER BY logged_seconds DESC;`;

      const result = await db.query(q, [...scopeParams, ...archivedParams, ...durationParams]);
      return result.rows.map(r => this.toRow(r));
    }

    // project / team / company share the same scoped aggregation, only the grouping differs.
    const groupSelect =
      level === "project"
        ? "st.project_id AS group_id, st.project_name AS group_name, st.color_code"
        : level === "team"
          ? "st.team_id AS group_id, (SELECT name FROM teams WHERE id = st.team_id) AS group_name, NULL::TEXT AS color_code"
          : "NULL::UUID AS group_id, 'Company'::TEXT AS group_name, NULL::TEXT AS color_code";

    const groupBy =
      level === "project"
        ? "GROUP BY st.project_id, st.project_name, st.color_code"
        : level === "team"
          ? "GROUP BY st.team_id"
          : "";

    const q = `
      WITH scoped_tasks AS (
        SELECT t.id,
               t.total_minutes,
               p.id AS project_id,
               p.name AS project_name,
               p.color_code,
               p.team_id
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        WHERE TRUE ${scopeClause} ${archivedClause}
      ),
      task_logged AS (
        SELECT task_work_log.task_id, SUM(task_work_log.time_spent) AS logged_seconds
        FROM task_work_log
        JOIN scoped_tasks st ON st.id = task_work_log.task_id
        WHERE TRUE ${durationClause}
        GROUP BY task_work_log.task_id
      ),
      -- Restrict estimate aggregation to tasks that have logs in the selected period
      -- so estimates and logs cover the same body of work.
      tasks_in_scope AS (
        SELECT DISTINCT task_id FROM task_logged
      )
      SELECT ${groupSelect},
             COALESCE(SUM(CASE WHEN tis.task_id IS NOT NULL THEN st.total_minutes * 60 ELSE 0 END), 0) AS estimated_seconds,
             COALESCE(SUM(tl.logged_seconds), 0) AS logged_seconds
      FROM scoped_tasks st
      LEFT JOIN task_logged tl ON tl.task_id = st.id
      LEFT JOIN tasks_in_scope tis ON tis.task_id = st.id
      ${groupBy}
      ORDER BY logged_seconds DESC;`;

    const result = await db.query(q, [...scopeParams, ...archivedParams, ...durationParams]);
    return result.rows
      .map(r => this.toRow(r))
      .filter(r => r.estimated_seconds > 0 || r.logged_seconds > 0);
  }

  @HandleExceptions()
  public static async getEfficiency(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const level = (req.body.level || "project") as EfficiencyLevel;
    if (!this.VALID_LEVELS.includes(level)) {
      return res.status(200).send(new ServerResponse(false, [], "Invalid efficiency level"));
    }

    const rows = await this.fetchEfficiency(req);
    return res.status(200).send(new ServerResponse(true, rows));
  }

  @HandleExceptions()
  public static async exportExcel(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<void> {
    // POST export: filters arrive in the request body (same shape as getEfficiency).
    const level = (req.body.level || "project") as EfficiencyLevel;
    const rows = await this.fetchEfficiency(req);

    const levelLabel = level.charAt(0).toUpperCase() + level.slice(1);
    const exportDate = moment().format("MMM-DD-YYYY");
    const fileName = `Efficiency (${levelLabel}) - ${exportDate}`;

    const workbook = new Excel.Workbook();
    const sheet = workbook.addWorksheet("Efficiency");

    sheet.columns = [
      { header: levelLabel, key: "group_name", width: 40 },
      { header: "Estimated", key: "estimated_string", width: 20 },
      { header: "Logged", key: "logged_string", width: 20 },
      { header: "Efficiency %", key: "efficiency", width: 18 }
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };

    for (const row of rows) {
      sheet.addRow({
        group_name: row.group_name,
        estimated_string: row.estimated_string,
        logged_string: row.logged_string,
        efficiency: row.efficiency_percent === null ? "-" : `${row.efficiency_percent}%`
      });
    }

    res.setHeader("Content-Type", "application/vnd.openxmlformats");
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  }
}
