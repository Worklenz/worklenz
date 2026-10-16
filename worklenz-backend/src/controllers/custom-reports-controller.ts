import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";

import db from "../config/db";
import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import {isValidUuid} from "../shared/validation-helpers";

type ReportSource = "items" | "sprints" | "releases" | "time";
type ReportMetric = "count" | "points" | "cycle" | "blocked" | "time" | "committed";
type ReportGroup = "assignee" | "status" | "epic" | "priority" | "type" | "sprint" | "release";
type ReportFilter = "all" | "active" | "bugs" | "blocked";
type ReportVisualization = "bar" | "line" | "donut" | "table" | "kpi";
type ReportVisibility = "project" | "private";
type ReportUnit = "count" | "points" | "days" | "hours";

interface IReportDefinition {
  source: ReportSource;
  metric: ReportMetric;
  group_by: ReportGroup;
  filter: ReportFilter;
}

interface IReportRow {
  key: string | null;
  label: string | null;
  color: string | null;
  value: number;
}

interface ISourceRules {
  metrics: ReportMetric[];
  groups: ReportGroup[];
  supportsFilter: boolean;
}

interface IGroupSql {
  join: string;
  key: string;
  label: string;
  color: string;
  sort: string;
}

const TASK_GROUPS: ReportGroup[] = ["assignee", "status", "epic", "priority", "type", "sprint", "release"];

const SOURCE_RULES: Record<ReportSource, ISourceRules> = {
  items: {metrics: ["count", "points", "cycle", "blocked"], groups: TASK_GROUPS, supportsFilter: true},
  time: {metrics: ["time"], groups: TASK_GROUPS, supportsFilter: true},
  sprints: {metrics: ["points", "committed", "count"], groups: ["sprint"], supportsFilter: false},
  releases: {metrics: ["count", "points"], groups: ["release"], supportsFilter: false},
};

const FILTERS: ReportFilter[] = ["all", "active", "bugs", "blocked"];
const VISUALIZATIONS: ReportVisualization[] = ["bar", "line", "donut", "table", "kpi"];
const VISIBILITIES: ReportVisibility[] = ["project", "private"];

const METRIC_UNITS: Record<ReportMetric, ReportUnit> = {
  count: "count",
  points: "points",
  committed: "points",
  cycle: "days",
  blocked: "count",
  time: "hours",
};

/** Whitelisted SQL fragments; user input never reaches the query text. */
const FILTER_SQL: Record<ReportFilter, string> = {
  all: "",
  active: `AND EXISTS (
    SELECT 1 FROM task_phase tpf
    INNER JOIN project_phases ppf ON ppf.id = tpf.phase_id
    WHERE tpf.task_id = t.id AND ppf.sprint_status = 'active')`,
  bugs: "AND t.issue_type = 'bug'",
  blocked: "AND t.is_blocked IS TRUE",
};

const STARTED_AT_JOIN = `
  LEFT JOIN LATERAL (
    SELECT COALESCE((
      SELECT MIN(tal.created_at)
      FROM task_activity_logs tal
      INNER JOIN task_statuses sts ON sts.id::TEXT = tal.new_value
      INNER JOIN sys_task_status_categories scat ON scat.id = sts.category_id
      WHERE tal.task_id = t.id AND tal.attribute_type = 'status' AND scat.is_doing IS TRUE
    ), t.created_at) AS started_at
  ) st ON TRUE`;

const TASK_METRIC_SQL: Record<"count" | "points" | "cycle" | "blocked" | "time", string> = {
  count: "COUNT(DISTINCT t.id)::FLOAT",
  points: "COALESCE(SUM(t.story_points), 0)::FLOAT",
  cycle: `PERCENTILE_CONT(0.5) WITHIN GROUP (
            ORDER BY GREATEST(EXTRACT(EPOCH FROM (t.completed_at - st.started_at)) / 86400, 0)
          ) FILTER (WHERE cat.is_done IS TRUE AND t.completed_at IS NOT NULL)`,
  blocked: "(COUNT(DISTINCT t.id) FILTER (WHERE t.is_blocked IS TRUE AND cat.is_done IS NOT TRUE))::FLOAT",
  time: "(COALESCE(SUM(twl.time_spent), 0) / 3600.0)::FLOAT",
};

const TOTAL_GROUP: IGroupSql = {join: "", key: "NULL::TEXT", label: "NULL::TEXT", color: "NULL::TEXT", sort: "0"};

const CUSTOM_REPORT_SELECT = `
  SELECT r.id, r.project_id, r.name, r.source, r.metric, r.group_by, r.filter, r.visualization,
         r.visibility, r.created_by, r.created_at, u.name AS created_by_name
  FROM project_custom_reports r
  LEFT JOIN users u ON u.id = r.created_by`;

export default class CustomReportsController extends WorklenzControllerBase {
  private static readonly NAME_MAX_LENGTH = 100;
  private static readonly MAX_ROWS = 50;
  private static readonly SPRINT_LIMIT = 12;

  @HandleExceptions()
  public static async list(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const projectId = req.query.project_id as string;
    if (!isValidUuid(projectId)) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid project id"));
    }

    const result = await db.query(
      `${CUSTOM_REPORT_SELECT}
       WHERE r.project_id = $1 AND (r.visibility = 'project' OR r.created_by = $2)
       ORDER BY r.created_at;`,
      [projectId, req.user?.id]
    );
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const projectId = req.body?.project_id;
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const definition = this.parseDefinition(req.body);
    const visualization = req.body?.visualization as ReportVisualization;
    const visibility = req.body?.visibility as ReportVisibility;

    if (!isValidUuid(projectId)) return res.status(400).send(new ServerResponse(false, null, "Invalid project id"));
    if (!name) return res.status(400).send(new ServerResponse(false, null, "Report name is required"));
    if (name.length > this.NAME_MAX_LENGTH) return res.status(400).send(new ServerResponse(false, null, "Report name is too long"));
    if (typeof definition === "string") return res.status(400).send(new ServerResponse(false, null, definition));
    if (!VISUALIZATIONS.includes(visualization)) return res.status(400).send(new ServerResponse(false, null, "Invalid visualization"));
    if (!VISIBILITIES.includes(visibility)) return res.status(400).send(new ServerResponse(false, null, "Invalid visibility"));

    const inserted = await db.query(
      `INSERT INTO project_custom_reports
         (project_id, name, source, metric, group_by, filter, visualization, visibility, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id;`,
      [
        projectId, name, definition.source, definition.metric, definition.group_by, definition.filter,
        visualization, visibility, req.user?.id,
      ]
    );
    const result = await db.query(`${CUSTOM_REPORT_SELECT} WHERE r.id = $1;`, [inserted.rows[0].id]);
    return res.status(200).send(new ServerResponse(true, result.rows[0]));
  }

  @HandleExceptions()
  public static async remove(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const projectId = req.query.project_id as string;
    const reportId = req.params.id;
    if (!isValidUuid(projectId) || !isValidUuid(reportId)) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid request"));
    }

    const report = await db.query(
      "SELECT created_by FROM project_custom_reports WHERE id = $1 AND project_id = $2;",
      [reportId, projectId]
    );
    if (!report.rowCount) return res.status(404).send(new ServerResponse(false, null, "Report not found"));

    const canDelete = report.rows[0].created_by === req.user?.id || req.user?.owner || req.user?.is_admin;
    if (!canDelete) {
      return res.status(403).send(new ServerResponse(false, null, "Only the report creator can delete this report"));
    }

    await db.query("DELETE FROM project_custom_reports WHERE id = $1;", [reportId]);
    return res.status(200).send(new ServerResponse(true, {id: reportId}));
  }

  @HandleExceptions()
  public static async preview(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const projectId = req.body?.project_id;
    const definition = this.parseDefinition(req.body);
    if (!isValidUuid(projectId)) return res.status(400).send(new ServerResponse(false, null, "Invalid project id"));
    if (typeof definition === "string") return res.status(400).send(new ServerResponse(false, null, definition));

    return res.status(200).send(new ServerResponse(true, await this.runReport(projectId, definition)));
  }

  @HandleExceptions()
  public static async getData(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const projectId = req.query.project_id as string;
    const reportId = req.params.id;
    if (!isValidUuid(projectId) || !isValidUuid(reportId)) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid request"));
    }

    const report = await db.query(
      `SELECT source, metric, group_by, filter
       FROM project_custom_reports
       WHERE id = $1 AND project_id = $2 AND (visibility = 'project' OR created_by = $3);`,
      [reportId, projectId, req.user?.id]
    );
    if (!report.rowCount) return res.status(404).send(new ServerResponse(false, null, "Report not found"));

    const definition = this.parseDefinition(report.rows[0]);
    if (typeof definition === "string") return res.status(400).send(new ServerResponse(false, null, definition));
    return res.status(200).send(new ServerResponse(true, await this.runReport(projectId, definition)));
  }

  /** Returns a validated definition, or an error message. */
  private static parseDefinition(body: Record<string, unknown> | undefined): IReportDefinition | string {
    const source = body?.source as ReportSource;
    const rules = SOURCE_RULES[source];
    if (!rules) return "Invalid data source";

    const metric = body?.metric as ReportMetric;
    const groupBy = body?.group_by as ReportGroup;
    const filter = (body?.filter ?? "all") as ReportFilter;
    if (!rules.metrics.includes(metric)) return "Invalid metric for this data source";
    if (!rules.groups.includes(groupBy)) return "Invalid grouping for this data source";
    if (!FILTERS.includes(filter)) return "Invalid filter";

    return {source, metric, group_by: groupBy, filter: rules.supportsFilter ? filter : "all"};
  }

  private static async runReport(projectId: string, definition: IReportDefinition) {
    const unit = METRIC_UNITS[definition.metric];
    if (definition.source === "sprints") {
      const rows = await this.runSprintReport(projectId, definition.metric);
      return {rows, total: this.sumRows(rows), unit};
    }
    if (definition.source === "releases") {
      const rows = await this.runReleaseReport(projectId, definition.metric);
      return {rows, total: this.sumRows(rows), unit};
    }

    const [rows, total] = await Promise.all([
      this.runTaskReport(projectId, definition, this.getGroupSql(definition)),
      this.runTaskReport(projectId, definition, TOTAL_GROUP),
    ]);
    return {rows, total: total[0]?.value ?? (definition.metric === "cycle" ? null : 0), unit};
  }

  private static async runTaskReport(projectId: string, definition: IReportDefinition, group: IGroupSql): Promise<IReportRow[]> {
    const isTime = definition.source === "time";
    const metricSql = TASK_METRIC_SQL[definition.metric as keyof typeof TASK_METRIC_SQL];
    const result = await db.query(
      `SELECT ${group.key} AS key,
              ${group.label} AS label,
              ${group.color} AS color,
              ${metricSql} AS value
       FROM tasks t
       LEFT JOIN task_statuses ts ON ts.id = t.status_id
       LEFT JOIN sys_task_status_categories cat ON cat.id = ts.category_id
       ${isTime ? "INNER JOIN task_work_log twl ON twl.task_id = t.id" : ""}
       ${definition.metric === "cycle" ? STARTED_AT_JOIN : ""}
       ${group.join}
       WHERE t.project_id = $1
         AND t.archived IS FALSE
         ${isTime ? "" : "AND t.parent_task_id IS NULL"}
         ${FILTER_SQL[definition.filter]}
       GROUP BY 1, 2, 3
       ORDER BY MIN(${group.sort}), 4 DESC
       LIMIT ${this.MAX_ROWS};`,
      [projectId]
    );
    return this.toRows(result.rows);
  }

  private static getGroupSql(definition: IReportDefinition): IGroupSql {
    switch (definition.group_by) {
      case "status":
        return {join: "", key: "ts.id::TEXT", label: "ts.name", color: "cat.color_code", sort: "ts.sort_order"};
      case "priority":
        return {
          join: "LEFT JOIN task_priorities pr ON pr.id = t.priority_id",
          key: "pr.id::TEXT", label: "pr.name", color: "pr.color_code", sort: "-pr.value",
        };
      case "epic":
        return {
          join: "LEFT JOIN project_epics ep ON ep.id = t.epic_id",
          key: "ep.id::TEXT", label: "ep.name", color: "ep.color_code", sort: "COALESCE(ep.sort_index, 2147483647)",
        };
      case "type":
        return {
          join: "",
          key: "COALESCE(t.issue_type, 'task')", label: "COALESCE(t.issue_type, 'task')", color: "NULL::TEXT",
          sort: "CASE COALESCE(t.issue_type, 'task') WHEN 'story' THEN 0 WHEN 'task' THEN 1 ELSE 2 END",
        };
      case "sprint":
        return {
          join: `LEFT JOIN LATERAL (
                   SELECT pp.id, pp.name, pp.color_code, pp.sort_index
                   FROM task_phase tp
                   INNER JOIN project_phases pp ON pp.id = tp.phase_id
                   WHERE tp.task_id = t.id
                   LIMIT 1
                 ) sp ON TRUE`,
          key: "sp.id::TEXT", label: "sp.name", color: "sp.color_code", sort: "COALESCE(sp.sort_index, 2147483647)",
        };
      case "release":
        return {
          join: "LEFT JOIN project_releases rl ON rl.id = t.release_id",
          key: "rl.id::TEXT", label: "rl.name", color: "NULL::TEXT",
          sort: "COALESCE(EXTRACT(EPOCH FROM COALESCE(rl.target_date::TIMESTAMPTZ, rl.created_at)), 9999999999)",
        };
      case "assignee":
      default:
        return definition.source === "time"
          ? {
            join: `LEFT JOIN team_member_info_view tm
                     ON tm.user_id = twl.user_id
                    AND tm.team_id = (SELECT team_id FROM projects WHERE id = $1)`,
            key: "twl.user_id::TEXT", label: "COALESCE(tm.name, '')", color: "NULL::TEXT", sort: "0",
          }
          : {
            join: `LEFT JOIN tasks_assignees ta ON ta.task_id = t.id
                   LEFT JOIN team_member_info_view tm ON tm.team_member_id = ta.team_member_id`,
            key: "ta.team_member_id::TEXT", label: "tm.name", color: "NULL::TEXT", sort: "0",
          };
    }
  }

  private static async runSprintReport(projectId: string, metric: ReportMetric): Promise<IReportRow[]> {
    const metricSql: Record<string, string> = {
      points: "COALESCE(pp.completed_points, live.done_points)",
      committed: "COALESCE(pp.committed_points, live.total_points + COALESCE(pp.carried_over_points, 0))",
      count: "COALESCE(pp.completed_issue_count, live.done_count)",
    };
    const result = await db.query(
      `SELECT pp.id::TEXT AS key, pp.name AS label, pp.color_code AS color, (${metricSql[metric]})::FLOAT AS value
       FROM project_phases pp
       LEFT JOIN LATERAL (
         SELECT COUNT(*) FILTER (WHERE cat.is_done IS TRUE) AS done_count,
                COALESCE(SUM(t.story_points) FILTER (WHERE cat.is_done IS TRUE), 0) AS done_points,
                COALESCE(SUM(t.story_points), 0) AS total_points
         FROM task_phase tp
         INNER JOIN tasks t ON t.id = tp.task_id AND t.archived IS FALSE AND t.parent_task_id IS NULL
         LEFT JOIN task_statuses ts ON ts.id = t.status_id
         LEFT JOIN sys_task_status_categories cat ON cat.id = ts.category_id
         WHERE tp.phase_id = pp.id
       ) live ON TRUE
       WHERE pp.project_id = $1 AND pp.sprint_status IN ('active', 'completed')
       ORDER BY COALESCE(pp.started_at, pp.start_date, pp.created_at) DESC
       LIMIT ${this.SPRINT_LIMIT};`,
      [projectId]
    );
    return this.toRows(result.rows).reverse();
  }

  private static async runReleaseReport(projectId: string, metric: ReportMetric): Promise<IReportRow[]> {
    const metricSql = metric === "points"
      ? "COALESCE(SUM(t.story_points) FILTER (WHERE cat.is_done IS TRUE), 0)"
      : "COUNT(t.id)";
    const result = await db.query(
      `SELECT r.id::TEXT AS key, r.name AS label, NULL::TEXT AS color, (${metricSql})::FLOAT AS value
       FROM project_releases r
       LEFT JOIN tasks t ON t.release_id = r.id AND t.archived IS FALSE
       LEFT JOIN task_statuses ts ON ts.id = t.status_id
       LEFT JOIN sys_task_status_categories cat ON cat.id = ts.category_id
       WHERE r.project_id = $1
       GROUP BY r.id, r.name, r.target_date, r.created_at
       ORDER BY COALESCE(r.target_date::TIMESTAMPTZ, r.created_at), r.created_at
       LIMIT ${this.MAX_ROWS};`,
      [projectId]
    );
    return this.toRows(result.rows);
  }

  private static toRows(rows: { key: string | null; label: string | null; color: string | null; value: number | null }[]): IReportRow[] {
    return rows
      .filter(row => row.value !== null)
      .map(row => ({
        key: row.key,
        label: row.label || null,
        color: row.color,
        value: Math.round(Number(row.value) * 10) / 10,
      }));
  }

  private static sumRows(rows: IReportRow[]): number {
    return Math.round(rows.reduce((total, row) => total + row.value, 0) * 10) / 10;
  }
}
