import Excel from "exceljs";
import moment from "moment";
import db from "../../config/db";
import { getColor } from "../../shared/utils";
import HandleExceptions from "../../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import ReportingControllerBaseWithTimezone from "./reporting-controller-base-with-timezone";
import {
  buildTimeLogMembersQuery,
  buildTimeLogsGroupsQuery,
  buildTimeLogsRowsQuery,
  buildTimeLogsTotalsQuery,
  ITimeLogsFilters,
  parsePagination,
  parseTimeLogsFilters,
  parseTimeLogsGroupBy,
  parseTimeLogsView,
  TIME_LOGS_EXPORT_ROW_CAP,
  TimeLogsExportMode,
  TimeLogsFilterError,
} from "./time-logs-query-builder";
import { buildTimeLogsCsv, buildTimeLogsWorkbook, getTimeLogsExportFileName, ITimeLogExportRow } from "./time-logs-export";
import { buildTimeLogGroupsCsv, buildTimeLogGroupsWorkbook, ITimeLogGroupExportRow } from "./time-logs-groups-export";

const NO_TEAM_MESSAGE = "Team not found";

interface ITaskRowMember {
  user_name: string | null;
}

/**
 * A By task row's members, alphabetically, each with the name-derived avatar colour that every
 * other initials avatar in the app gets.
 */
const withMemberColors = <T extends ITaskRowMember>(members: T[] | null): (T & { color_code: string })[] =>
  (members ?? [])
    .map(member => ({ ...member, color_code: getColor(member.user_name ?? undefined) }))
    .sort((a, b) => (a.user_name ?? "").localeCompare(b.user_name ?? ""));

/**
 * Reports > Time Logs. Registered behind `teamOwnerOrAdminValidator`, so every
 * caller already sees the whole team — there is no per-member scoping here.
 */
export default class ReportingTimeLogsController extends ReportingControllerBaseWithTimezone {
  private static async resolveFilters(
    req: IWorkLenzRequest,
    raw: Record<string, unknown>,
    mode: TimeLogsExportMode = "filtered"
  ): Promise<ITimeLogsFilters> {
    const teamId = req.user?.team_id;
    if (!teamId) throw new TimeLogsFilterError(NO_TEAM_MESSAGE);
    const timezone = await this.getUserTimezone(req.user?.id as string);
    return parseTimeLogsFilters(raw, { teamId, timezone }, mode);
  }

  /**
   * Runs a handler body and answers a rejected filter (bad id, bad date, no team) with a 400 and
   * its message; anything else is rethrown for `@HandleExceptions` to turn into the generic error.
   */
  private static async answerFilterErrors<T extends IWorkLenzResponse | void>(
    res: IWorkLenzResponse,
    work: () => Promise<T>
  ): Promise<T | IWorkLenzResponse> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof TimeLogsFilterError) {
        return res.status(400).send(new ServerResponse(false, null, error.message));
      }
      throw error;
    }
  }

  /**
   * `POST /reporting/time-logs` — one page of entries plus whole-set totals. With `view: "task"`
   * the page lists tasks instead (their entries summed), and `total` counts tasks.
   */
  @HandleExceptions()
  public static async getTimeLogs(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    return this.answerFilterErrors(res, async () => {
      const body = (req.body || {}) as Record<string, unknown>;
      const filters = await this.resolveFilters(req, body);
      const { page, pageSize } = parsePagination(body);
      const view = parseTimeLogsView(body.view);

      const rowsQuery = buildTimeLogsRowsQuery(filters, {
        sortField: body.sort_field as string | undefined,
        sortOrder: body.sort_order as string | undefined,
        view,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      const totalsQuery = buildTimeLogsTotalsQuery(filters);

      const [rowsResult, totalsResult] = await Promise.all([
        db.query(rowsQuery.text, rowsQuery.values),
        db.query(totalsQuery.text, totalsQuery.values),
      ]);

      const [totals] = totalsResult.rows;
      const logs =
        view === "task"
          ? rowsResult.rows.map(row => ({ ...row, members: withMemberColors(row.members) }))
          : rowsResult.rows;

      return res.status(200).send(
        new ServerResponse(true, {
          logs,
          // Which shape the rows have, so a client that has since switched views can tell.
          view,
          // What the pager counts: tasks in the By task view, entries otherwise.
          total: (view === "task" ? totals?.total_tasks : totals?.total) ?? 0,
          total_entries: totals?.total ?? 0,
          total_seconds: totals?.total_seconds ?? 0,
          page,
          page_size: pageSize,
        })
      );
    });
  }

  /**
   * `POST /reporting/time-logs/groups` — one page of groups (`group_by`: member, project or
   * client) with their billable / non-billable rollups, plus the whole-set totals. A group's own
   * entries are not included: opening one loads them through `POST /reporting/time-logs` narrowed
   * to that group, so a large team never ships every entry up front.
   */
  @HandleExceptions()
  public static async getTimeLogGroups(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    return this.answerFilterErrors(res, async () => {
      const body = (req.body || {}) as Record<string, unknown>;
      const groupBy = parseTimeLogsGroupBy(body.group_by);
      if (!groupBy) throw new TimeLogsFilterError("group_by must be one of: member, project, client");

      const filters = await this.resolveFilters(req, body);
      const { page, pageSize } = parsePagination(body);

      const groupsQuery = buildTimeLogsGroupsQuery(filters, groupBy, {
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      const totalsQuery = buildTimeLogsTotalsQuery(filters);

      const [groupsResult, totalsResult] = await Promise.all([
        db.query(groupsQuery.text, groupsQuery.values),
        db.query(totalsQuery.text, totalsQuery.values),
      ]);

      const [totals] = totalsResult.rows;
      const groups = groupsResult.rows.map(row => {
        const group = {
          ...row,
          // A member group's avatar gets the same name-derived colour as everywhere else.
          ...(groupBy === "member" ? { group_color: getColor(row.group_label ?? undefined) } : {}),
        };
        // The count of all groups rides on every row (a window function); it is reported once below.
        delete group.total_groups;
        return group;
      });

      return res.status(200).send(
        new ServerResponse(true, {
          groups,
          // Which dimension the groups are, so a client that has since switched it can tell.
          group_by: groupBy,
          total_groups: groupsResult.rows[0]?.total_groups ?? 0,
          total_entries: totals?.total ?? 0,
          total_seconds: totals?.total_seconds ?? 0,
          page,
          page_size: pageSize,
        })
      );
    });
  }

  /**
   * `GET /reporting/time-logs/members` — the Member filter's options: active
   * members, plus deactivated/removed users who logged time in the range.
   */
  @HandleExceptions()
  public static async getTimeLogMembers(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    return this.answerFilterErrors(res, async () => {
      const filters = await this.resolveFilters(req, (req.query || {}) as Record<string, unknown>, "all");
      const query = buildTimeLogMembersQuery(filters);
      const result = await db.query(query.text, query.values);

      const members = result.rows.map((row: { name: string | null }) => ({
        ...row,
        color_code: getColor(row.name ?? undefined),
      }));
      return res.status(200).send(new ServerResponse(true, members));
    });
  }

  /**
   * `GET /reporting/time-logs/projects` — the Project filter's options: every
   * project of the viewer's team, archived ones included, because their
   * entries still appear in the table.
   */
  @HandleExceptions()
  public static async getTimeLogProjects(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    if (!teamId) return res.status(400).send(new ServerResponse(false, null, NO_TEAM_MESSAGE));

    const result = await db.query(
      `SELECT p.id, p.name, p.color_code
       FROM projects p
       WHERE p.team_id = $1
       ORDER BY LOWER(p.name) ASC;`,
      [teamId]
    );
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  /** Writes the file the exports build, as a CSV or an Excel workbook download. */
  private static async sendExport(
    res: IWorkLenzResponse,
    format: "csv" | "xlsx",
    fileName: string,
    build: { csv: () => string; workbook: () => Excel.Workbook }
  ): Promise<void> {
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.write(build.csv());
      res.end();
      return;
    }
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    await build.workbook().xlsx.write(res);
    res.end();
  }

  /**
   * `GET /reporting-export/time-logs` — `format=xlsx|csv`, `mode=filtered|all`.
   *
   * "filtered" exports the screen as it is — whichever page it is on, because the file holds
   * every page of it: one row per entry, one row per task (`view=task`), or one row per group
   * with its rollup (`group_by=member|project|client`). "all" keeps the date range, drops every
   * other filter and is always the entries as logged. Every file ends with a Total row.
   */
  @HandleExceptions()
  public static async exportTimeLogs(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse | void> {
    return this.answerFilterErrors(res, async () => {
      const query = (req.query || {}) as Record<string, unknown>;
      const mode: TimeLogsExportMode = query.mode === "all" ? "all" : "filtered";
      const format = query.format === "csv" ? "csv" : "xlsx";
      const filters = await this.resolveFilters(req, query, mode);
      const groupBy = mode === "filtered" ? parseTimeLogsGroupBy(query.group_by) : null;
      const fileName = getTimeLogsExportFileName(format, moment().format("MMM-DD-YYYY"), groupBy);

      if (groupBy) {
        // The screen is grouped, so the file is too: every group of the filtered set. One extra
        // group tells us whether the cap cut the export short.
        const groupsQuery = buildTimeLogsGroupsQuery(filters, groupBy, { limit: TIME_LOGS_EXPORT_ROW_CAP + 1 });
        const result = await db.query(groupsQuery.text, groupsQuery.values);
        const truncated = result.rows.length > TIME_LOGS_EXPORT_ROW_CAP;
        const groups = (truncated ? result.rows.slice(0, TIME_LOGS_EXPORT_ROW_CAP) : result.rows) as ITimeLogGroupExportRow[];
        return this.sendExport(res, format, fileName, {
          csv: () => buildTimeLogGroupsCsv(groups, groupBy, { truncated }),
          workbook: () => buildTimeLogGroupsWorkbook(groups, groupBy, { truncated }),
        });
      }

      // "All entries in the date range" is always the entries as logged.
      const view = mode === "filtered" ? parseTimeLogsView(query.view) : "flat";

      // One extra row tells us whether the cap cut the export short.
      const rowsQuery = buildTimeLogsRowsQuery(filters, {
        sortField: mode === "filtered" ? (query.sort_field as string | undefined) : undefined,
        sortOrder: mode === "filtered" ? (query.sort_order as string | undefined) : undefined,
        view,
        limit: TIME_LOGS_EXPORT_ROW_CAP + 1,
      });
      const result = await db.query(rowsQuery.text, rowsQuery.values);

      const truncated = result.rows.length > TIME_LOGS_EXPORT_ROW_CAP;
      const rows = (truncated ? result.rows.slice(0, TIME_LOGS_EXPORT_ROW_CAP) : result.rows) as ITimeLogExportRow[];
      return this.sendExport(res, format, fileName, {
        csv: () => buildTimeLogsCsv(rows, { truncated, view }),
        workbook: () => buildTimeLogsWorkbook(rows, { truncated, view }),
      });
    });
  }
}
