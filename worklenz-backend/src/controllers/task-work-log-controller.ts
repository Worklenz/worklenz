import Excel from "exceljs";
import moment from "moment";

import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";

import db from "../config/db";
import { formatDuration, getColor, log_error, toSeconds } from "../shared/utils";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import momentTime from "moment-timezone";
import { SocketEvents } from "../socket.io/events";
import { IO } from "../shared/io";
import {
  resolveTimeEntriesVisibilityScope,
  buildTimeEntriesScopePredicate,
} from "../shared/time-entries-visibility";
import { isTeamOwner, isTeamAdmin } from "../shared/team-permissions";
import { resolveTaskWorkLogManageAccess } from "../shared/task-work-log-access";
import { sanitizeCsvValue } from "../shared/csv-export";

type GroupByDimension = "member" | "client" | "project";

// Column list is identical across dimensions (NULL-cast placeholders for the
// fields a given dimension doesn't use) so the response shape stays uniform
// for the frontend regardless of which grouping was requested. There is no
// "task" dimension: per-task totals are the flat feed's `view=task` mode
// (getMyTimeLogEntries) instead.
const GROUP_CONFIG: Record<GroupByDimension, { keyExpr: string; labelExpr: string; extraSelect: string; groupByExpr: string }> = {
  member: {
    keyExpr: "fl.user_id::text",
    labelExpr: "MIN(fl.user_name)",
    extraSelect: "MIN(fl.avatar_url) AS group_avatar_url, NULL::text AS group_color",
    groupByExpr: "fl.user_id",
  },
  client: {
    keyExpr: "COALESCE(fl.client_id::text, 'none')",
    labelExpr: "MIN(fl.client_name)",
    extraSelect: "NULL::text AS group_avatar_url, NULL::text AS group_color",
    groupByExpr: "fl.client_id",
  },
  project: {
    keyExpr: "fl.project_id::text",
    labelExpr: "MIN(fl.project_name)",
    extraSelect: "NULL::text AS group_avatar_url, MIN(fl.project_color) AS group_color",
    groupByExpr: "fl.project_id",
  },
};

// Sortable columns of the Time Entries table feed AND its CSV export — one
// place, so the export's row order can always mirror the table's. In the "By
// task" view each column is an aggregate over the task's matching entries.
const ENTRY_SORT_COLUMNS: Record<string, string> = {
  task_name: "t1.name",
  project_name: "pr.name",
  priority_name: "tp.name",
  status_name: "ts.name",
  billable: "t1.billable",
  user_name: "user_name",
  time_spent: "twl.time_spent",
  created_at: "twl.created_at",
  due_date: "t1.end_date",
};

const TASK_VIEW_SORT_COLUMNS: Record<string, string> = {
  task_name: "t1.name",
  project_name: "pr.name",
  priority_name: "tp.name",
  status_name: "ts.name",
  billable: "t1.billable",
  user_name: "MIN(u.name)",
  time_spent: "SUM(twl.time_spent)",
  created_at: "MAX(twl.created_at)",
  due_date: "t1.end_date",
};

/** ORDER BY body (without the keyword) for the entry feed / task view / export. */
function buildTimeLogOrderBy(sortField: string | undefined, sortOrder: string | undefined, isTaskView: boolean): string {
  const columns = isTaskView ? TASK_VIEW_SORT_COLUMNS : ENTRY_SORT_COLUMNS;
  // Own-property check: a bare `columns[sortField]` would resolve inherited
  // names like "constructor" to a function and splice it into the SQL.
  const column = sortField && Object.prototype.hasOwnProperty.call(columns, sortField)
    ? columns[sortField]
    : (isTaskView ? "MAX(twl.created_at)" : "twl.created_at");
  const direction = (sortOrder || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
  // Tasks with no due date should always sort to the end, in either direction —
  // otherwise DESC surfaces them first (Postgres treats NULL as the largest value).
  const nulls = sortField === "due_date" ? " NULLS LAST" : "";
  // One row per task can tie on the sort key (e.g. equal totals), so break
  // ties on the task id to keep page boundaries stable between requests.
  const tieBreaker = isTaskView ? ", t1.id ASC" : "";
  return `${column} ${direction}${nulls}${tieBreaker}`;
}

/**
 * SQL predicate (on a `task_work_log` row aliased `twl`) for "the caller may modify this log":
 * they logged it, or they're an owner/admin and the log belongs to a task in their own team.
 * `userParam`, `canEditOthersParam` and `teamParam` are the 1-based parameter positions of the
 * caller's user id, the (server-computed) owner/admin flag and their team id — every one is
 * referenced, so Postgres can always infer their types.
 */
function timeLogModifiableByUser(userParam: number, canEditOthersParam: number, teamParam: number): string {
  return `(
    twl.user_id = $${userParam}
    OR ($${canEditOthersParam}::boolean AND EXISTS (
      SELECT 1
      FROM tasks t
      INNER JOIN projects p ON p.id = t.project_id
      WHERE t.id = twl.task_id AND p.team_id = $${teamParam}::uuid
    ))
  )`;
}

export default class TaskWorklogController extends WorklenzControllerBase {
  // Broadcasts to every team member's own socket instead of a server-wide
  // io.emit — a work log entry is only ever relevant to the acting user's
  // team, so a global broadcast would have every other team on the server
  // refetch their time-logged data for no reason. Mirrors the socket_id
  // lookup + per-socket IO.emit loop already used for project comment
  // reactions (project-comment-reactions-controller.ts), scoped to
  // team_members instead of project_members since this data isn't
  // project-specific (e.g. Home's Focus Time stat spans all of a user's projects).
  private static async emitTaskTimeLogUpdated(teamId: string | undefined, taskId: string | undefined) {
    if (!teamId || !taskId) return;
    const membersQuery = `
      SELECT DISTINCT u.socket_id
      FROM team_members tm
      INNER JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = $1
        AND u.socket_id IS NOT NULL
    `;
    const membersResult = await db.query(membersQuery, [teamId]);
    for (const member of membersResult.rows) {
      IO.emit(SocketEvents.TASK_TIME_LOG_UPDATED, member.socket_id, { task_id: taskId });
    }
  }

  @HandleExceptions()
  public static async create(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    const { id, seconds_spent, description, created_at, formatted_start } =
      req.body;
    const q = `INSERT INTO task_work_log (time_spent, description, task_id, user_id, created_at)
               VALUES ($1, $2, $3, $4, $5);`;
    const params = [
      seconds_spent,
      description,
      id,
      req.user?.id,
      formatted_start,
    ];
    const result = await db.query(q, params);
    const [data] = result.rows;

    await this.emitTaskTimeLogUpdated(req.user?.team_id, id);

    return res.status(200).send(new ServerResponse(true, data));
  }

  // Sums task_work_log time across every descendant subtask (recursive, not just
  // direct children) since subtasks can themselves have subtasks — a flat
  // parent_task_id = $1 join would silently under-count grandchild-level time,
  // the same class of bug as #1978. Mirrors the WITH RECURSIVE task_descendants
  // pattern already used in tasks-controller-v2.ts, including excluding archived
  // descendants so archiving a subtask drops its time out of the parent's total.
  // Swallows its own errors (falling back to 0) so a failure here never takes
  // down the rest of getByTask's response, which already has its own logs to show.
  private static async getSubtasksTotalTimeSpent(id: string): Promise<number> {
    if (!id) return 0;

    const q = `
      WITH RECURSIVE task_descendants AS (
        SELECT id FROM tasks WHERE parent_task_id = $1 AND archived IS FALSE
        UNION ALL
        SELECT t.id
        FROM tasks t
        INNER JOIN task_descendants td ON t.parent_task_id = td.id
        WHERE t.archived IS FALSE
      )
      SELECT COALESCE(SUM(twl.time_spent), 0) AS total_time_spent
      FROM task_work_log twl
      INNER JOIN task_descendants td ON twl.task_id = td.id;
    `;
    try {
      const result = await db.query(q, [id]);
      return Number(result.rows[0]?.total_time_spent || 0);
    } catch (error) {
      log_error(error);
      return 0;
    }
  }

  private static async getTimeLogs(id: string, timeZone: string) {
    if (!id) return [];

    const q = `
      WITH time_logs AS (
        --
        SELECT id,
               description,
               time_spent,
               created_at,
               user_id,
               logged_by_timer,
               (SELECT name FROM users WHERE users.id = task_work_log.user_id) AS user_name,
               (SELECT email FROM users WHERE users.id = task_work_log.user_id) AS user_email,
               (SELECT avatar_url FROM users WHERE users.id = task_work_log.user_id) AS avatar_url
        FROM task_work_log
        WHERE task_id = $1
        --
      )
      SELECT id,
             time_spent,
             description,
             created_at,
             user_id,
             logged_by_timer,
             created_at AS start_time,
             (created_at + INTERVAL '1 second' * time_spent) AS end_time,
             user_name,
             user_email,
             avatar_url
      FROM time_logs
      ORDER BY created_at DESC;
    `;
    const result = await db.query(q, [id]);
    if (timeZone) {
      for (const res of result.rows) {
        res.start_time = momentTime.tz(res.start_time, `${timeZone}`).format();
        res.end_time = momentTime.tz(res.end_time, `${timeZone}`).format();
      }
    }
    return result.rows;
  }

  @HandleExceptions()
  public static async getByTask(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    const [logs, subtasksTotalTimeSpent] = await Promise.all([
      this.getTimeLogs(req.params.id, req.query.time_zone_name as string),
      this.getSubtasksTotalTimeSpent(req.params.id),
    ]);

    for (const item of logs) item.avatar_color = getColor(item.user_name);

    return res.status(200).send(new ServerResponse(true, {
      logs,
      subtasks_total_time_spent: subtasksTotalTimeSpent,
    }));
  }

  @HandleExceptions()
  public static async update(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    const { seconds_spent, description, formatted_start, new_task_id } =
      req.body;

    const access = await resolveTaskWorkLogManageAccess(
      req.params.id,
      req.user
    );
    if (!access?.canManage) {
      return res
        .status(403)
        .send(
          new ServerResponse(
            false,
            null,
            "You do not have permission to edit this time log."
          )
        );
    }

    const oldTaskId = access.task_id;

    // If new_task_id is provided and differs from the current task, move the log
    const targetTaskId = new_task_id || oldTaskId;

    const q = `
      UPDATE task_work_log
      SET time_spent  = $2,
          description = $3,
          created_at  = $4,
          task_id = $5
      WHERE id = $1
      RETURNING task_id;
    `;
    const params = [
      req.params.id,
      seconds_spent,
      description || null,
      formatted_start,
      targetTaskId,
    ];
    const result = await db.query(q, params);
    const [data] = result.rows;

    // Notify the new (or same) task
    await this.emitTaskTimeLogUpdated(req.user?.team_id, data?.task_id);
    // If the log was moved, also notify the old task so its totals refresh
    if (oldTaskId && oldTaskId !== data?.task_id) {
      await this.emitTaskTimeLogUpdated(req.user?.team_id, oldTaskId);
    }

    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async deleteById(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    const access = await resolveTaskWorkLogManageAccess(
      req.params.id,
      req.user
    );
    if (!access?.canManage) {
      return res
        .status(403)
        .send(
          new ServerResponse(
            false,
            null,
            "You do not have permission to delete this time log."
          )
        );
    }

    // When a task query param is provided, ensure it matches the log's task.
    if (req.query.task && req.query.task !== access.task_id) {
      return res
        .status(400)
        .send(new ServerResponse(false, null, "Time log does not belong to this task."));
    }

    const q = `DELETE
               FROM task_work_log
               WHERE id = $1
               RETURNING task_id;`;
    const result = await db.query(q, [req.params.id]);
    const [data] = result.rows;

    await this.emitTaskTimeLogUpdated(req.user?.team_id, data?.task_id);

    return res.status(200).send(new ServerResponse(true, data));
  }

  /**
   * Time Entries page ONLY (PUT /task-time-log/entries/:id). Unlike update() — the task drawer's
   * route, which stays author-only — a log may be edited by its author OR, for owners/admins,
   * by anyone in their own team. Everyone else (members, team leads) can edit only their own.
   * The role is read from the session, never from the request. Moving a log to another task is
   * deliberately not supported here.
   */
  @HandleExceptions()
  public static async updateTimeEntry(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    const { seconds_spent, description, formatted_start } = req.body;
    const canEditOthers = isTeamOwner(req.user) || isTeamAdmin(req.user);

    const q = `
      UPDATE task_work_log AS twl
      SET time_spent  = $5,
          description = $6,
          created_at  = $7
      WHERE twl.id = $1
        AND ${timeLogModifiableByUser(2, 3, 4)}
      RETURNING twl.task_id;
    `;
    const result = await db.query(q, [
      req.params.id,
      req.user?.id,
      canEditOthers,
      req.user?.team_id,
      seconds_spent,
      description || null,
      formatted_start,
    ]);
    const [data] = result.rows;

    // Nothing matched: not the caller's entry and the caller isn't an owner/admin (or it no
    // longer exists). Say so rather than reporting a success that changed nothing.
    if (!data) {
      return res.status(403).send(
        new ServerResponse(false, null, "You can only edit your own time entries.")
      );
    }

    await this.emitTaskTimeLogUpdated(req.user?.team_id, data.task_id);

    return res.status(200).send(new ServerResponse(true, data));
  }

  /** Time Entries page ONLY (DELETE /task-time-log/entries/:id) — same rule as updateTimeEntry(). */
  @HandleExceptions()
  public static async deleteTimeEntry(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    const canEditOthers = isTeamOwner(req.user) || isTeamAdmin(req.user);

    const q = `DELETE
               FROM task_work_log AS twl
               WHERE twl.id = $1
                 AND twl.task_id = $2
                 AND ${timeLogModifiableByUser(3, 4, 5)}
               RETURNING twl.task_id;`;
    const result = await db.query(q, [
      req.params.id,
      req.query.task,
      req.user?.id,
      canEditOthers,
      req.user?.team_id,
    ]);
    const [data] = result.rows;

    if (!data) {
      return res.status(403).send(
        new ServerResponse(false, null, "You can only delete your own time entries.")
      );
    }

    await this.emitTaskTimeLogUpdated(req.user?.team_id, data.task_id);

    return res.status(200).send(new ServerResponse(true, data));
  }

  private static async getExportMetadata(id: string) {
    const q = `SELECT name, (SELECT name FROM projects WHERE id = tasks.project_id) AS project_name
               FROM tasks
               WHERE id = $1;`;
    const result = await db.query(q, [id]);
    return result.rows[0] || null;
  }

  private static async getUserTimeZone(id: string) {
    if (id) {
      const q = `SELECT utc_offset
                 FROM timezones
                 WHERE id = (SELECT timezone_id FROM users WHERE id = $1);`;
      const result = await db.query(q, [id]);
      const [data] = result.rows;
      return data.utc_offset || null;
    }
  }

  @HandleExceptions()
  public static async exportLog(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<void> {
    const results = await this.getTimeLogs(
      req.params.id,
      req.query.timeZone as string,
    );
    const metadata = await this.getExportMetadata(req.params.id);
    const timezone = await this.getUserTimeZone(req.user?.id || "");

    const exportDate = moment().format("MMM-DD-YYYY");
    const fileName = `${exportDate} - Task Timelog`;
    const title = metadata.name.replace(/[\*\?\:\/\\\[\]]/g, "-");

    const workbook = new Excel.Workbook();
    const sheet = workbook.addWorksheet(title);

    sheet.headerFooter = {
      firstHeader: title,
    };

    sheet.columns = [
      { header: "Reporter Name", key: "user_name", width: 25 },
      { header: "Reporter Email", key: "user_email", width: 25 },
      { header: "Start Time", key: "start_time", width: 25 },
      { header: "End Time", key: "end_time", width: 25 },
      { header: "Date", key: "created_at", width: 25 },
      { header: "Work Description", key: "description", width: 25 },
      { header: "Duration", key: "time_spent", width: 25 },
    ];

    sheet.getCell("A1").value = metadata.project_name;
    sheet.mergeCells("A1:G1");
    sheet.getCell("A1").alignment = { horizontal: "center" };

    sheet.getCell("A2").value = `${metadata.name} (${exportDate})`;
    sheet.mergeCells("A2:G2");
    sheet.getCell("A2").alignment = { horizontal: "center" };

    sheet.getRow(4).values = [
      "Reporter Name",
      "Reporter Email",
      "Start Time",
      "End Time",
      "Date",
      "Work Description",
      "Duration",
    ];

    const timeFormat = "MMM DD, YYYY h:mm:ss a";
    let totalLogged = 0;

    for (const item of results) {
      totalLogged += parseFloat((item.time_spent || 0).toString());
      const data = {
        user_name: item.user_name,
        user_email: item.user_email,
        start_time: moment(item.start_time)
          .add(timezone.hours || 0, "hours")
          .add(timezone.minutes || 0, "minutes")
          .format(timeFormat),
        end_time: moment(item.end_time)
          .add(timezone.hours || 0, "hours")
          .add(timezone.minutes || 0, "minutes")
          .format(timeFormat),
        created_at: moment(item.created_at)
          .add(timezone.hours || 0, "hours")
          .add(timezone.minutes || 0, "minutes")
          .format(timeFormat),
        description: item.description || "-",
        time_spent: formatDuration(moment.duration(item.time_spent, "seconds")),
      };
      sheet.addRow(data);
    }

    sheet.getCell("A1").style.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "D9D9D9" },
    };
    sheet.getCell("A1").font = {
      size: 16,
    };

    sheet.getCell("A2").style.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "F2F2F2" },
    };
    sheet.getCell("A2").font = {
      size: 12,
    };

    sheet.getRow(4).font = {
      bold: true,
    };

    sheet.addRow({
      user_name: "",
      user_email: "",
      start_time: "Total",
      end_time: "",
      description: "",
      created_at: "",
      time_spent: formatDuration(moment.duration(totalLogged, "seconds")),
    });

    sheet.mergeCells(`A${sheet.rowCount}:F${sheet.rowCount}`);

    sheet.getCell(`A${sheet.rowCount}`).value = "Total";
    sheet.getCell(`A${sheet.rowCount}`).alignment = {
      horizontal: "right",
    };

    res.setHeader("Content-Type", "application/vnd.openxmlformats");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${fileName}.xlsx`,
    );

    await workbook.xlsx.write(res).then(() => {
      res.end();
    });
  }

  @HandleExceptions()
  public static async getAllRunningTimers(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    const q = `SELECT
                tt.task_id,
                tt.start_time,
                t1.name AS task_name,
                pr.id AS project_id,
                pr.name AS project_name,
                t1.parent_task_id,
                t2.name AS parent_task_name,
                COALESCE((SELECT SUM(time_spent) FROM task_work_log WHERE task_id = tt.task_id AND user_id = tt.user_id), 0) AS total_time_logged
            FROM task_timers tt
            LEFT JOIN public.tasks t1 ON tt.task_id = t1.id
            LEFT JOIN public.tasks t2 ON t1.parent_task_id = t2.id -- Optimized join for parent task name
            INNER JOIN projects pr ON t1.project_id = pr.id -- INNER JOIN ensures project-team match
            WHERE tt.user_id = $1
              AND pr.team_id = $2;`;
    const params = [req.user?.id, req.user?.team_id];
    const result = await db.query(q, params);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getMyTasksWithLogs(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    const { date_filter, project_id, search, date_from, date_to } = req.query as Record<string, string>;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.page_size as string) || 20));
    const userId = req.user?.id;
    const teamId = req.user?.team_id;
    const teamMemberId = req.user?.team_member_id;

    // The date filters operate on the LOG date (task_work_log.created_at), i.e.
    // when time was logged — not the task due date. The date predicate is applied
    // inside the LEFT JOIN so only in-period logs are aggregated, and a task only
    // surfaces when it has matching logs (logHaving). "no_logged_time" is the one
    // exception: it joins ALL of the user's logs and keeps tasks with zero total.
    const buildQuery = (logDateCondition: string, logHaving: string, extraParams: any[], extraConditions: string[], pg: number, pgSize: number) => {
      const baseParams: any[] = [teamMemberId, teamId, userId, ...extraParams];
      const limitIdx = baseParams.length + 1;
      const offsetIdx = baseParams.length + 2;
      const offset = (pg - 1) * pgSize;
      const allParams = [...baseParams, pgSize, offset];
      const baseConditions = [
        `ta.team_member_id = $1`,
        `p.team_id = $2`,
        `t.archived = FALSE`,
        `NOT EXISTS (SELECT 1 FROM archived_projects ap WHERE ap.project_id = p.id AND ap.user_id = $3)`,
        ...extraConditions,
      ];
      const joinDate = logDateCondition ? ` AND ${logDateCondition}` : "";
      const q = `
        SELECT
          t.id AS task_id,
          t.name AS task_name,
          t.end_date AS due_date,
          t.done,
          p.id AS project_id,
          p.name AS project_name,
          p.color_code AS project_color,
          COALESCE(SUM(twl.time_spent), 0) AS total_time_spent,
          MAX(twl.created_at) AS last_logged_at,
          COALESCE(
            JSON_AGG(
              JSON_BUILD_OBJECT(
                'id', twl.id,
                'time_spent', twl.time_spent,
                'description', twl.description,
                'created_at', twl.created_at,
                'logged_by_timer', twl.logged_by_timer
              ) ORDER BY twl.created_at DESC
            ) FILTER (WHERE twl.id IS NOT NULL),
            '[]'::JSON
          ) AS time_logs,
          COUNT(*) OVER() AS total_count
        FROM tasks t
        JOIN projects p ON t.project_id = p.id
        JOIN tasks_assignees ta ON ta.task_id = t.id
        LEFT JOIN task_work_log twl ON twl.task_id = t.id AND twl.user_id = $3${joinDate}
        WHERE ${baseConditions.join(' AND ')}
        GROUP BY t.id, t.name, t.end_date, t.done, p.id, p.name, p.color_code
        ${logHaving}
        ORDER BY MAX(twl.created_at) DESC NULLS LAST, t.end_date ASC NULLS LAST
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `;
      return { q, params: allParams };
    };

    const extraParams: any[] = [];
    const extraConditions: string[] = [];
    let paramIdx = 4;

    if (search) {
      extraConditions.push(`(t.name ILIKE $${paramIdx} OR CAST(t.task_no AS TEXT) = $${paramIdx + 1})`);
      extraParams.push(`%${search}%`, search);
      paramIdx += 2;
    }

    if (project_id) {
      const projectIds = project_id.split(",").filter(Boolean);
      if (projectIds.length) {
        extraConditions.push(`t.project_id = ANY($${paramIdx}::uuid[])`);
        extraParams.push(projectIds);
        paramIdx++;
      }
    }

    const activeFilter = date_filter || "this_week";

    // Tasks must have logged time in the period -> require a non-zero total.
    const hasLoggedTimeHaving = `HAVING COALESCE(SUM(twl.time_spent), 0) > 0`;

    let logDateCondition = "";
    let logHaving = hasLoggedTimeHaving;

    if (activeFilter === "custom" && date_from && date_to) {
      // Plain timestamptz range comparisons (no ::date cast) so a query plan
      // that reaches for idx_task_work_log_user_created_at can use
      // created_at as a genuine index range condition instead of a
      // row-by-row Filter — see the same rewrite in getMyTimeLogEntries.
      logDateCondition = `twl.created_at >= $${paramIdx}::date AND twl.created_at < ($${paramIdx + 1}::date + INTERVAL '1 day')`;
      extraParams.push(date_from, date_to);
      paramIdx += 2;
    } else {
      switch (activeFilter) {
        case "today":
          logDateCondition = `twl.created_at >= CURRENT_DATE AND twl.created_at < CURRENT_DATE + INTERVAL '1 day'`;
          break;
        case "yesterday":
          logDateCondition = `twl.created_at >= (CURRENT_DATE - INTERVAL '1 day') AND twl.created_at < CURRENT_DATE`;
          break;
        case "last_week":
          logDateCondition = `twl.created_at >= (CURRENT_DATE - INTERVAL '7 days') AND twl.created_at < CURRENT_DATE`;
          break;
        case "no_logged_time":
          // Join ALL of the user's logs, keep tasks with zero total time.
          logDateCondition = "";
          logHaving = `HAVING COALESCE(SUM(twl.time_spent), 0) = 0`;
          break;
        default:
          // "this_week" and any unrecognized value fall back to the current
          // (Monday-start) calendar week, through end of today.
          logDateCondition = `twl.created_at >= date_trunc('week', CURRENT_DATE) AND twl.created_at < CURRENT_DATE + INTERVAL '1 day'`;
      }
    }

    if (activeFilter === "today") {
      const todayQ = buildQuery(`twl.created_at >= CURRENT_DATE AND twl.created_at < CURRENT_DATE + INTERVAL '1 day'`, hasLoggedTimeHaving, extraParams, extraConditions, page, pageSize);
      const result = await db.query(todayQ.q, todayQ.params);
      const total = result.rows[0]?.total_count ? parseInt(result.rows[0].total_count) : 0;
      return res.status(200).send(new ServerResponse(true, { tasks: result.rows, fallback_date: null, total }));
    }

    const { q, params } = buildQuery(logDateCondition, logHaving, extraParams, extraConditions, page, pageSize);
    const result = await db.query(q, params);
    const total = result.rows[0]?.total_count ? parseInt(result.rows[0].total_count) : 0;
    return res.status(200).send(new ServerResponse(true, { tasks: result.rows, fallback_date: null, total }));
  }

  @HandleExceptions()
  public static async getMySummary(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    // "Today"/"This week" boundaries are computed in the user's local timezone
    // (via users.timezone_id -> timezones.utc_offset) rather than the DB
    // server's session timezone, so logs near midnight land in the right bucket.
    // Reflects the viewer's All/My scope (like the rest of the page), never
    // the grouping — this endpoint has no group_by param.
    const { scope, person_id, client_id } = req.query as Record<string, string>;
    const personIds = person_id ? person_id.split(",").filter(Boolean) : [];
    const clientIds = client_id ? client_id.split(",").filter(Boolean) : [];

    const params: any[] = [req.user?.id, req.user?.team_id];
    const visibilityScope = await resolveTimeEntriesVisibilityScope(req);
    const scopePredicate = buildTimeEntriesScopePredicate(scope, 1, "p.id", visibilityScope, params);
    let idx = scopePredicate.nextParamIdx;

    const extraConditions: string[] = [];
    if (personIds.length) {
      extraConditions.push(`twl.user_id = ANY($${idx}::uuid[])`);
      params.push(personIds);
      idx++;
    }
    if (clientIds.length) {
      const hasNone = clientIds.includes("none");
      const realIds = clientIds.filter(id => id !== "none");
      const parts: string[] = [];
      if (realIds.length) {
        parts.push(`p.client_id = ANY($${idx}::uuid[])`);
        params.push(realIds);
        idx++;
      }
      if (hasNone) parts.push(`p.client_id IS NULL`);
      if (parts.length) extraConditions.push(`(${parts.join(" OR ")})`);
    }
    const extraClause = extraConditions.length ? ` AND ${extraConditions.join(" AND ")}` : "";

    const q = `
      WITH user_tz AS (
        SELECT COALESCE(tz.utc_offset, INTERVAL '0') AS tz_offset
        FROM users u
        LEFT JOIN timezones tz ON tz.id = u.timezone_id
        WHERE u.id = $1
      )
      SELECT
        COALESCE(SUM(twl.time_spent) FILTER (
          WHERE (twl.created_at AT TIME ZONE 'UTC' + user_tz.tz_offset)::date
              = (now() AT TIME ZONE 'UTC' + user_tz.tz_offset)::date
        ), 0) AS today_total,
        COALESCE(SUM(twl.time_spent) FILTER (
          WHERE (twl.created_at AT TIME ZONE 'UTC' + user_tz.tz_offset)::date
              = (now() AT TIME ZONE 'UTC' + user_tz.tz_offset)::date
            AND t.billable IS TRUE
        ), 0) AS today_billable,
        COALESCE(SUM(twl.time_spent) FILTER (
          WHERE (twl.created_at AT TIME ZONE 'UTC' + user_tz.tz_offset)::date
              = (now() AT TIME ZONE 'UTC' + user_tz.tz_offset)::date
            AND t.billable IS FALSE
        ), 0) AS today_non_billable,
        COALESCE(SUM(twl.time_spent) FILTER (
          WHERE (twl.created_at AT TIME ZONE 'UTC' + user_tz.tz_offset)
              >= date_trunc('week', (now() AT TIME ZONE 'UTC' + user_tz.tz_offset))
        ), 0) AS week_total,
        COALESCE(SUM(twl.time_spent) FILTER (
          WHERE (twl.created_at AT TIME ZONE 'UTC' + user_tz.tz_offset)
              >= date_trunc('week', (now() AT TIME ZONE 'UTC' + user_tz.tz_offset))
            AND t.billable IS TRUE
        ), 0) AS week_billable,
        COALESCE(SUM(twl.time_spent) FILTER (
          WHERE (twl.created_at AT TIME ZONE 'UTC' + user_tz.tz_offset)
              >= date_trunc('week', (now() AT TIME ZONE 'UTC' + user_tz.tz_offset))
            AND t.billable IS FALSE
        ), 0) AS week_non_billable
      FROM task_work_log twl
      JOIN tasks t ON twl.task_id = t.id
      JOIN projects p ON t.project_id = p.id
      CROSS JOIN user_tz
      WHERE ${scopePredicate.clause}
        AND p.team_id = $2${extraClause}
        -- Coarse WHERE-level bound so idx_task_work_log_user_created_at can
        -- skip a user's/team's older history entirely instead of joining
        -- every row ever logged just to bucket "today"/"this week" via the
        -- FILTER clauses above (confirmed via EXPLAIN ANALYZE: ~55x fewer
        -- buffer hits on production data). 8 days comfortably covers any
        -- timezone's start-of-week skew relative to the DB session's
        -- CURRENT_DATE, on top of the 7-day week width itself — the FILTER
        -- clauses remain the source of truth for the exact, timezone-aware
        -- boundary.
        AND twl.created_at >= CURRENT_DATE - INTERVAL '8 days';
    `;
    const result = await db.query(q, params);
    return res.status(200).send(new ServerResponse(true, result.rows[0] || {
      today_total: 0,
      today_billable: 0,
      today_non_billable: 0,
      week_total: 0,
      week_billable: 0,
      week_non_billable: 0,
    }));
  }

  @HandleExceptions()
  public static async getMyWeeklyBreakdown(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    // Monday-Sunday billable/non-billable time per day for the current week,
    // in the user's local timezone. Always returns 7 rows (zero-filled).
    // Reflects the viewer's All/My scope, never the grouping.
    const { scope, person_id, client_id } = req.query as Record<string, string>;
    const personIds = person_id ? person_id.split(",").filter(Boolean) : [];
    const clientIds = client_id ? client_id.split(",").filter(Boolean) : [];

    const params: any[] = [req.user?.id, req.user?.team_id];
    const visibilityScope = await resolveTimeEntriesVisibilityScope(req);
    // Scope is resolved against qualifying_logs below (a CTE, not a LEFT JOIN
    // ON clause) so it can reference the projects table without a forward
    // reference to a table joined later in the days/user_tz chain.
    const scopePredicate = buildTimeEntriesScopePredicate(scope, 1, "p.id", visibilityScope, params);
    let idx = scopePredicate.nextParamIdx;

    const extraConditions: string[] = [];
    if (personIds.length) {
      extraConditions.push(`twl.user_id = ANY($${idx}::uuid[])`);
      params.push(personIds);
      idx++;
    }
    if (clientIds.length) {
      const hasNone = clientIds.includes("none");
      const realIds = clientIds.filter(id => id !== "none");
      const parts: string[] = [];
      if (realIds.length) {
        parts.push(`p.client_id = ANY($${idx}::uuid[])`);
        params.push(realIds);
        idx++;
      }
      if (hasNone) parts.push(`p.client_id IS NULL`);
      if (parts.length) extraConditions.push(`(${parts.join(" OR ")})`);
    }
    const extraClause = extraConditions.length ? ` AND ${extraConditions.join(" AND ")}` : "";

    const q = `
      WITH user_tz AS (
        SELECT COALESCE(tz.utc_offset, INTERVAL '0') AS tz_offset
        FROM users u
        LEFT JOIN timezones tz ON tz.id = u.timezone_id
        WHERE u.id = $1
      ),
      week_bounds AS (
        SELECT date_trunc('week', (now() AT TIME ZONE 'UTC' + tz_offset))::date AS week_start
        FROM user_tz
      ),
      days AS (
        SELECT generate_series(week_start, week_start + INTERVAL '6 days', INTERVAL '1 day')::date AS day
        FROM week_bounds
      ),
      qualifying_logs AS (
        SELECT twl.time_spent, twl.created_at, t.billable
        FROM task_work_log twl
        JOIN tasks t ON t.id = twl.task_id
        JOIN projects p ON p.id = t.project_id
        WHERE p.team_id = $2
          AND ${scopePredicate.clause}${extraClause}
          -- Same coarse bound as getMySummary — lets the index skip a
          -- user's/team's older history instead of joining their entire
          -- log history just to bucket the current week.
          AND twl.created_at >= CURRENT_DATE - INTERVAL '8 days'
      )
      SELECT
        d.day::text AS day,
        COALESCE(SUM(ql.time_spent) FILTER (WHERE ql.billable IS TRUE), 0) AS billable,
        COALESCE(SUM(ql.time_spent) FILTER (WHERE ql.billable IS FALSE), 0) AS non_billable
      FROM days d
      CROSS JOIN user_tz
      LEFT JOIN qualifying_logs ql
        ON (ql.created_at AT TIME ZONE 'UTC' + user_tz.tz_offset)::date = d.day
      GROUP BY d.day
      ORDER BY d.day;
    `;
    const result = await db.query(q, params);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getMyRecentProjects(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    const q = `
      SELECT DISTINCT ON (p.id)
        p.id,
        p.name,
        p.color_code
      FROM task_work_log twl
      JOIN tasks t ON twl.task_id = t.id
      JOIN projects p ON t.project_id = p.id
      WHERE twl.user_id = $1
        AND p.team_id = $2
        AND t.archived = FALSE
        AND NOT EXISTS (SELECT 1 FROM archived_projects ap WHERE ap.project_id = p.id AND ap.user_id = $1)
      ORDER BY p.id, twl.created_at DESC
      LIMIT 3;
    `;
    const result = await db.query(q, [req.user?.id, req.user?.team_id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getMyTasksInProject(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    const { project_id, search } = req.query as Record<string, string>;
    if (!project_id) return res.status(200).send(new ServerResponse(false, [], "project_id is required"));

    const params: any[] = [project_id];
    const conditions: string[] = [
      `t.project_id = $1::uuid`,
      `t.archived = FALSE`,
    ];

    if (search) {
      conditions.push(`(t.name ILIKE $2 OR CAST(t.task_no AS TEXT) = $3)`);
      params.push(`%${search}%`, search);
    }

    const q = `
      SELECT
        t.id,
        t.name,
        t.end_date AS due_date,
        t.task_no
      FROM tasks t
      WHERE ${conditions.join(" AND ")}
      ORDER BY t.name ASC
      LIMIT 500;
    `;
    const result = await db.query(q, params);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }


  @HandleExceptions()
  public static async getRecentTimeLogs(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    // Widget-scoped "recent logs" feed for the Home > Log Time page — not a full
    // history (that's /task-time-log/my-tasks, used by the Time Entries page).
    // `limit` lets the frontend pull a large-enough batch to sort/filter/paginate
    // client-side, matching the pattern used by the Overview page's priority table.
    const limit = Math.min(300, Math.max(1, parseInt(req.query.limit as string, 10) || 100));
    const q = `
      SELECT
        twl.id,
        twl.task_id,
        twl.created_at,
        twl.time_spent,
        t1.name AS task_name,
        t1.billable,
        pr.id AS project_id,
        pr.name AS project_name,
        pr.color_code AS project_color,
        t1.parent_task_id,
        t2.name AS parent_task_name,
        ts.name AS status_name,
        COALESCE(ts.color_code, tsc.color_code) AS status_color,
        COALESCE(ts.color_code, tsc.color_code_dark, tsc.color_code) AS status_color_dark,
        tsc.is_done,
        tp.name AS priority_name,
        tp.color_code AS priority_color,
        tp.color_code_dark AS priority_color_dark
      FROM task_work_log twl
      INNER JOIN tasks t1 ON twl.task_id = t1.id
      INNER JOIN projects pr ON t1.project_id = pr.id
      LEFT JOIN tasks t2 ON t1.parent_task_id = t2.id
      LEFT JOIN task_statuses ts ON t1.status_id = ts.id
      LEFT JOIN sys_task_status_categories tsc ON ts.category_id = tsc.id
      LEFT JOIN task_priorities tp ON t1.priority_id = tp.id
      WHERE twl.user_id = $1
        AND pr.team_id = $2
        AND t1.archived = FALSE
        AND NOT EXISTS (
          SELECT 1
          FROM archived_projects ap
          WHERE ap.project_id = pr.id
            AND ap.user_id = $1
        )
      ORDER BY twl.created_at DESC
      LIMIT $3;
    `;
    const params = [req.user?.id, req.user?.team_id, limit];
    const result = await db.query(q, params);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getMyTimeLogEntries(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    // Full-history, per-log-entry feed for the Time Entries page's flat table —
    // same row shape as getRecentTimeLogs (status/priority/billable per entry)
    // but with the page's real date/project/search filters, sorting, and true
    // page-based pagination instead of a capped recent-logs limit.
    //
    // `view=task` returns the same row shape and honors the exact same
    // filters/scope, but collapses the matching entries into one row per task
    // (time_spent summed, created_at = most recent matching entry) — the flat
    // table's "By task" toggle. Filters apply to entries *before* grouping, so
    // a task's sum only covers entries that match the current filters.
    const {
      date_filter, project_id, search, date_from, date_to, sort_field, sort_order, scope, person_id, client_id,
      status, priority_id, billable, view,
    } = req.query as Record<string, string>;
    const isTaskView = view === "task";
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.page_size as string, 10) || 20));
    const offset = (page - 1) * pageSize;

    const activeFilter = date_filter || "this_week";

    // "No logged time" describes tasks, not log entries — every row here is
    // already a logged entry, so that filter can never match anything.
    if (activeFilter === "no_logged_time") {
      return res.status(200).send(new ServerResponse(true, { logs: [], total: 0 }));
    }

    const personIds = person_id ? person_id.split(",").filter(Boolean) : [];
    const clientIds = client_id ? client_id.split(",").filter(Boolean) : [];

    const params: any[] = [req.user?.id, req.user?.team_id];
    const visibilityScope = await resolveTimeEntriesVisibilityScope(req);
    const scopePredicate = buildTimeEntriesScopePredicate(scope, 1, "t1.project_id", visibilityScope, params);

    const conditions: string[] = [
      scopePredicate.clause,
      `pr.team_id = $2`,
      `t1.archived = FALSE`,
      `NOT EXISTS (SELECT 1 FROM archived_projects ap WHERE ap.project_id = pr.id AND ap.user_id = $1)`,
    ];
    let idx = scopePredicate.nextParamIdx;

    if (activeFilter === "custom" && date_from && date_to) {
      // Plain timestamptz range comparisons (no ::date cast on the column)
      // so the planner can use idx_task_work_log_user_created_at's
      // created_at column as a genuine index range condition instead of
      // falling back to a Bitmap Heap Scan + row-by-row Filter — confirmed
      // via EXPLAIN ANALYZE against production data (~12x faster even on a
      // few hundred rows; the gap widens with history size).
      conditions.push(`twl.created_at >= $${idx}::date AND twl.created_at < ($${idx + 1}::date + INTERVAL '1 day')`);
      params.push(date_from, date_to);
      idx += 2;
    } else if (activeFilter === "yesterday") {
      conditions.push(`twl.created_at >= (CURRENT_DATE - INTERVAL '1 day') AND twl.created_at < CURRENT_DATE`);
    } else if (activeFilter === "last_week") {
      conditions.push(`twl.created_at >= (CURRENT_DATE - INTERVAL '7 days') AND twl.created_at < CURRENT_DATE`);
    } else if (activeFilter === "today") {
      conditions.push(`twl.created_at >= CURRENT_DATE AND twl.created_at < CURRENT_DATE + INTERVAL '1 day'`);
    } else if (activeFilter === "this_week") {
      // Current (Monday-start) calendar week, through end of today.
      conditions.push(`twl.created_at >= date_trunc('week', CURRENT_DATE) AND twl.created_at < CURRENT_DATE + INTERVAL '1 day'`);
    }
    // Any other value (e.g. a future "all time" option) is left unfiltered by date.

    if (project_id) {
      const projectIds = project_id.split(",").filter(Boolean);
      if (projectIds.length) {
        conditions.push(`t1.project_id = ANY($${idx}::uuid[])`);
        params.push(projectIds);
        idx++;
      }
    }

    if (search) {
      conditions.push(`(t1.name ILIKE $${idx} OR CAST(t1.task_no AS TEXT) = $${idx + 1} OR twl.description ILIKE $${idx})`);
      params.push(`%${search}%`, search);
      idx += 2;
    }

    if (personIds.length) {
      conditions.push(`twl.user_id = ANY($${idx}::uuid[])`);
      params.push(personIds);
      idx++;
    }

    if (clientIds.length) {
      const hasNone = clientIds.includes("none");
      const realIds = clientIds.filter(id => id !== "none");
      const parts: string[] = [];
      if (realIds.length) {
        parts.push(`pr.client_id = ANY($${idx}::uuid[])`);
        params.push(realIds);
        idx++;
      }
      if (hasNone) parts.push(`pr.client_id IS NULL`);
      if (parts.length) conditions.push(`(${parts.join(" OR ")})`);
    }

    if (status) {
      // Status names are project-scoped (each project defines its own "To
      // Do"/"Doing"/"Done" rows), so filter values are lowercased names —
      // mirrors the dedupe-by-name approach in HomePageController.getTaskFilterOptions.
      const statusNames = status.split(",").filter(Boolean).map(s => s.toLowerCase());
      if (statusNames.length) {
        conditions.push(`LOWER(ts.name) = ANY($${idx}::text[])`);
        params.push(statusNames);
        idx++;
      }
    }

    if (priority_id) {
      const priorityIds = priority_id.split(",").filter(Boolean);
      if (priorityIds.length) {
        conditions.push(`t1.priority_id = ANY($${idx}::uuid[])`);
        params.push(priorityIds);
        idx++;
      }
    }

    if (billable) {
      // Both Yes and No selected is equivalent to no filter; only a single
      // selected value actually narrows the result set.
      const billableValues = Array.from(new Set(billable.split(",").filter(Boolean)));
      if (billableValues.length === 1) {
        conditions.push(`t1.billable = $${idx}`);
        params.push(billableValues[0] === "true");
        idx++;
      }
    }

    // Same ordering the CSV export uses (see buildTimeLogOrderBy), so the two
    // can't drift apart.
    const orderBy = buildTimeLogOrderBy(sort_field, sort_order, isTaskView);

    const limitIdx = idx;
    const offsetIdx = idx + 1;
    params.push(pageSize, offset);

    const flatQuery = `
      SELECT
        twl.id,
        twl.task_id,
        twl.created_at,
        twl.time_spent,
        twl.description,
        twl.user_id,
        (SELECT name FROM users WHERE users.id = twl.user_id) AS user_name,
        (SELECT avatar_url FROM users WHERE users.id = twl.user_id) AS avatar_url,
        t1.name AS task_name,
        t1.billable,
        t1.end_date AS due_date,
        pr.id AS project_id,
        pr.name AS project_name,
        pr.color_code AS project_color,
        t1.parent_task_id,
        t2.name AS parent_task_name,
        ts.name AS status_name,
        COALESCE(ts.color_code, tsc.color_code) AS status_color,
        COALESCE(ts.color_code, tsc.color_code_dark, tsc.color_code) AS status_color_dark,
        tsc.is_done,
        tp.name AS priority_name,
        tp.color_code AS priority_color,
        tp.color_code_dark AS priority_color_dark,
        COUNT(*) OVER() AS total_count
      FROM task_work_log twl
      INNER JOIN tasks t1 ON twl.task_id = t1.id
      INNER JOIN projects pr ON t1.project_id = pr.id
      LEFT JOIN tasks t2 ON t1.parent_task_id = t2.id
      LEFT JOIN task_statuses ts ON t1.status_id = ts.id
      LEFT JOIN sys_task_status_categories tsc ON ts.category_id = tsc.id
      LEFT JOIN task_priorities tp ON t1.priority_id = tp.id
      WHERE ${conditions.join(" AND ")}
      ORDER BY ${orderBy}
      LIMIT $${limitIdx} OFFSET $${offsetIdx};
    `;

    // Same columns as the flat query so the table renders both identically:
    // `id` is the task id (the row's unique key), time_spent is the summed
    // seconds, created_at is the latest matching entry, description joins the
    // non-empty entry descriptions (newest first), and `members` lists every
    // distinct user who logged against the task (user_id/user_name/avatar_url
    // only make sense per entry, so they're replaced by `members`).
    // COUNT(*) OVER() runs after GROUP BY, so total_count is the number of
    // tasks — what pagination needs.
    const taskViewQuery = `
      SELECT
        t1.id AS id,
        t1.id AS task_id,
        MAX(twl.created_at) AS created_at,
        COALESCE(SUM(twl.time_spent), 0)::FLOAT8 AS time_spent,
        STRING_AGG(NULLIF(BTRIM(twl.description), ''), ' • ' ORDER BY twl.created_at DESC) AS description,
        JSONB_AGG(DISTINCT JSONB_BUILD_OBJECT(
          'user_id', twl.user_id,
          'user_name', u.name,
          'avatar_url', u.avatar_url
        )) AS members,
        t1.name AS task_name,
        t1.billable,
        t1.end_date AS due_date,
        pr.id AS project_id,
        pr.name AS project_name,
        pr.color_code AS project_color,
        t1.parent_task_id,
        t2.name AS parent_task_name,
        ts.name AS status_name,
        COALESCE(ts.color_code, tsc.color_code) AS status_color,
        COALESCE(ts.color_code, tsc.color_code_dark, tsc.color_code) AS status_color_dark,
        tsc.is_done,
        tp.name AS priority_name,
        tp.color_code AS priority_color,
        tp.color_code_dark AS priority_color_dark,
        COUNT(*) OVER() AS total_count
      FROM task_work_log twl
      INNER JOIN tasks t1 ON twl.task_id = t1.id
      INNER JOIN projects pr ON t1.project_id = pr.id
      LEFT JOIN users u ON u.id = twl.user_id
      LEFT JOIN tasks t2 ON t1.parent_task_id = t2.id
      LEFT JOIN task_statuses ts ON t1.status_id = ts.id
      LEFT JOIN sys_task_status_categories tsc ON ts.category_id = tsc.id
      LEFT JOIN task_priorities tp ON t1.priority_id = tp.id
      WHERE ${conditions.join(" AND ")}
      GROUP BY
        t1.id, t1.name, t1.billable, t1.end_date, t1.parent_task_id,
        pr.id, pr.name, pr.color_code,
        t2.name,
        ts.name, ts.color_code,
        tsc.color_code, tsc.color_code_dark, tsc.is_done,
        tp.name, tp.color_code, tp.color_code_dark
      ORDER BY ${orderBy}
      LIMIT $${limitIdx} OFFSET $${offsetIdx};
    `;

    const q = isTaskView ? taskViewQuery : flatQuery;
    const result = await db.query(q, params);
    const total = result.rows[0]?.total_count ? parseInt(result.rows[0].total_count, 10) : 0;
    // Member avatars use the same name-derived colour as Home > My Tasks'
    // assignees (getColor), so a person looks identical across both tables.
    const logs = result.rows.map(({ total_count, ...rest }) =>
      isTaskView
        ? { ...rest, members: (rest.members ?? []).map((m: { user_name?: string }) => ({ ...m, color_code: getColor(m.user_name) })) }
        : { ...rest, user_color_code: getColor(rest.user_name) }
    );
    return res.status(200).send(new ServerResponse(true, { logs, total }));
  }

  @HandleExceptions()
  public static async getMyGroupedEntries(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    // Generalized grouped-view endpoint for Member/Client/Project grouping.
    // A single endpoint (rather than one per dimension) keeps the
    // security-sensitive scope predicate in exactly one place. Pagination is
    // at the GROUP level (COUNT(*) OVER() on the grouped CTE) since the date
    // filters already bound total row count to at most ~7 days or a custom
    // range, but group *count* (e.g. number of distinct members) isn't
    // bounded the same way.
    const groupBy = (req.query.group_by as string) || "";
    if (!Object.prototype.hasOwnProperty.call(GROUP_CONFIG, groupBy)) {
      return res.status(400).send(new ServerResponse(false, null, "group_by must be one of: member, client, project"));
    }

    const { date_filter, project_id, search, date_from, date_to, scope, person_id, client_id } =
      req.query as Record<string, string>;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.page_size as string, 10) || 20));
    const offset = (page - 1) * pageSize;

    const activeFilter = date_filter || "this_week";
    if (activeFilter === "no_logged_time") {
      return res.status(200).send(new ServerResponse(true, { groups: [], total_groups: 0 }));
    }

    const personIds = person_id ? person_id.split(",").filter(Boolean) : [];
    const clientIds = client_id ? client_id.split(",").filter(Boolean) : [];

    const params: any[] = [req.user?.id, req.user?.team_id];
    const visibilityScope = await resolveTimeEntriesVisibilityScope(req);
    const scopePredicate = buildTimeEntriesScopePredicate(scope, 1, "t1.project_id", visibilityScope, params);

    const conditions: string[] = [
      scopePredicate.clause,
      `pr.team_id = $2`,
      `t1.archived = FALSE`,
      `NOT EXISTS (SELECT 1 FROM archived_projects ap WHERE ap.project_id = pr.id AND ap.user_id = $1)`,
    ];
    let idx = scopePredicate.nextParamIdx;

    if (activeFilter === "custom" && date_from && date_to) {
      // Plain timestamptz range comparisons (no ::date cast on the column)
      // so the planner can use idx_task_work_log_user_created_at's
      // created_at column as a genuine index range condition instead of
      // falling back to a Bitmap Heap Scan + row-by-row Filter — confirmed
      // via EXPLAIN ANALYZE against production data (~12x faster even on a
      // few hundred rows; the gap widens with history size).
      conditions.push(`twl.created_at >= $${idx}::date AND twl.created_at < ($${idx + 1}::date + INTERVAL '1 day')`);
      params.push(date_from, date_to);
      idx += 2;
    } else if (activeFilter === "yesterday") {
      conditions.push(`twl.created_at >= (CURRENT_DATE - INTERVAL '1 day') AND twl.created_at < CURRENT_DATE`);
    } else if (activeFilter === "last_week") {
      conditions.push(`twl.created_at >= (CURRENT_DATE - INTERVAL '7 days') AND twl.created_at < CURRENT_DATE`);
    } else if (activeFilter === "today") {
      conditions.push(`twl.created_at >= CURRENT_DATE AND twl.created_at < CURRENT_DATE + INTERVAL '1 day'`);
    } else if (activeFilter === "this_week") {
      conditions.push(`twl.created_at >= date_trunc('week', CURRENT_DATE) AND twl.created_at < CURRENT_DATE + INTERVAL '1 day'`);
    }

    if (project_id) {
      const projectIds = project_id.split(",").filter(Boolean);
      if (projectIds.length) {
        conditions.push(`t1.project_id = ANY($${idx}::uuid[])`);
        params.push(projectIds);
        idx++;
      }
    }

    if (search) {
      conditions.push(`(t1.name ILIKE $${idx} OR CAST(t1.task_no AS TEXT) = $${idx + 1} OR twl.description ILIKE $${idx})`);
      params.push(`%${search}%`, search);
      idx += 2;
    }

    if (personIds.length) {
      conditions.push(`twl.user_id = ANY($${idx}::uuid[])`);
      params.push(personIds);
      idx++;
    }

    if (clientIds.length) {
      const hasNone = clientIds.includes("none");
      const realIds = clientIds.filter(id => id !== "none");
      const parts: string[] = [];
      if (realIds.length) {
        parts.push(`pr.client_id = ANY($${idx}::uuid[])`);
        params.push(realIds);
        idx++;
      }
      if (hasNone) parts.push(`pr.client_id IS NULL`);
      if (parts.length) conditions.push(`(${parts.join(" OR ")})`);
    }

    const cfg = GROUP_CONFIG[groupBy as GroupByDimension];
    const limitIdx = idx;
    const offsetIdx = idx + 1;
    params.push(pageSize, offset);

    const q = `
      WITH filtered_logs AS (
        SELECT
          twl.id, twl.time_spent, twl.description, twl.created_at, twl.logged_by_timer,
          twl.user_id, u.name AS user_name, u.avatar_url,
          t1.id AS task_id, t1.name AS task_name, t1.billable, t1.end_date AS due_date,
          pr.id AS project_id, pr.name AS project_name, pr.color_code AS project_color,
          pr.client_id, c.name AS client_name,
          ts.name AS status_name,
          COALESCE(ts.color_code, tsc.color_code) AS status_color,
          COALESCE(ts.color_code, tsc.color_code_dark, tsc.color_code) AS status_color_dark,
          tp.name AS priority_name,
          tp.color_code AS priority_color,
          tp.color_code_dark AS priority_color_dark
        FROM task_work_log twl
        INNER JOIN tasks t1 ON twl.task_id = t1.id
        INNER JOIN projects pr ON t1.project_id = pr.id
        INNER JOIN users u ON u.id = twl.user_id
        LEFT JOIN clients c ON c.id = pr.client_id
        LEFT JOIN task_statuses ts ON t1.status_id = ts.id
        LEFT JOIN sys_task_status_categories tsc ON ts.category_id = tsc.id
        LEFT JOIN task_priorities tp ON t1.priority_id = tp.id
        WHERE ${conditions.join(" AND ")}
      ),
      grouped AS (
        SELECT
          ${cfg.keyExpr} AS group_key,
          ${cfg.labelExpr} AS group_label,
          ${cfg.extraSelect},
          COALESCE(SUM(fl.time_spent), 0) AS subtotal,
          COUNT(*) AS entry_count,
          COUNT(DISTINCT fl.project_id) AS project_count,
          COUNT(DISTINCT fl.user_id) AS member_count,
          COUNT(DISTINCT fl.task_id) AS task_count,
          COUNT(*) FILTER (WHERE COALESCE(fl.billable, FALSE)) AS billable_entry_count,
          COUNT(DISTINCT fl.task_id) FILTER (WHERE COALESCE(fl.billable, FALSE)) AS billable_task_count,
          COALESCE(SUM(fl.time_spent) FILTER (WHERE COALESCE(fl.billable, FALSE)), 0) AS billable_time,
          COUNT(*) FILTER (WHERE NOT COALESCE(fl.billable, FALSE)) AS non_billable_entry_count,
          COUNT(DISTINCT fl.task_id) FILTER (WHERE NOT COALESCE(fl.billable, FALSE)) AS non_billable_task_count,
          COALESCE(SUM(fl.time_spent) FILTER (WHERE NOT COALESCE(fl.billable, FALSE)), 0) AS non_billable_time
        FROM filtered_logs fl
        GROUP BY ${cfg.groupByExpr}
      ),
      paged_groups AS (
        SELECT *, COUNT(*) OVER() AS total_groups
        FROM grouped
        ORDER BY group_label ASC NULLS LAST
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
      )
      SELECT
        pg.group_key, pg.group_label, pg.group_avatar_url, pg.group_color,
        pg.subtotal, pg.entry_count, pg.total_groups,
        pg.project_count, pg.member_count, pg.task_count,
        pg.billable_entry_count, pg.billable_task_count, pg.billable_time,
        pg.non_billable_entry_count, pg.non_billable_task_count, pg.non_billable_time,
        COALESCE(JSON_AGG(JSON_BUILD_OBJECT(
          'id', fl.id, 'task_id', fl.task_id, 'task_name', fl.task_name,
          'project_id', fl.project_id, 'project_name', fl.project_name, 'project_color', fl.project_color,
          'billable', fl.billable, 'time_spent', fl.time_spent, 'description', fl.description,
          'due_date', fl.due_date, 'created_at', fl.created_at, 'logged_by_timer', fl.logged_by_timer,
          'user_id', fl.user_id, 'user_name', fl.user_name, 'avatar_url', fl.avatar_url,
          'status_name', fl.status_name, 'status_color', fl.status_color, 'status_color_dark', fl.status_color_dark,
          'priority_name', fl.priority_name, 'priority_color', fl.priority_color, 'priority_color_dark', fl.priority_color_dark
        ) ORDER BY fl.created_at DESC), '[]') AS entries
      FROM paged_groups pg
      JOIN filtered_logs fl ON ${cfg.keyExpr} = pg.group_key
      GROUP BY pg.group_key, pg.group_label, pg.group_avatar_url, pg.group_color,
        pg.subtotal, pg.entry_count, pg.total_groups,
        pg.project_count, pg.member_count, pg.task_count,
        pg.billable_entry_count, pg.billable_task_count, pg.billable_time,
        pg.non_billable_entry_count, pg.non_billable_task_count, pg.non_billable_time
      ORDER BY pg.group_label ASC NULLS LAST;
    `;

    const result = await db.query(q, params);
    const totalGroups = result.rows[0]?.total_groups ? parseInt(result.rows[0].total_groups, 10) : 0;
    // Same name-derived avatar colour as the flat table and Home > My Tasks;
    // a Member group's header avatar gets it too (other groupings keep theirs).
    const groups = result.rows.map(({ total_groups, ...rest }) => ({
      ...rest,
      ...(groupBy === "member" ? { group_color: getColor(rest.group_label) } : {}),
      entries: (rest.entries ?? []).map((e: { user_name?: string }) => ({ ...e, user_color_code: getColor(e.user_name) })),
    }));
    return res.status(200).send(new ServerResponse(true, { groups, total_groups: totalGroups }));
  }

  @HandleExceptions()
  public static async getMyContext(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    // Bundles "what can I see" (visibility scope) and "what did I last
    // choose to see" (saved preferences) into one round trip, since the
    // frontend needs both simultaneously on page mount.
    const visibilityScope = await resolveTimeEntriesVisibilityScope(req);

    const teamMemberId = req.user?.team_member_id;
    let preferences = { group_by: "none", scope: "all" };
    if (teamMemberId) {
      try {
        const prefResult = await db.query(
          `SELECT time_entries_group_by, time_entries_scope FROM team_members WHERE id = $1`,
          [teamMemberId]
        );
        const row = prefResult.rows[0];
        if (row) {
          preferences = {
            group_by: row.time_entries_group_by || "none",
            scope: row.time_entries_scope || "all",
          };
        }
      } catch (error) {
        // The time_entries_group_by/scope columns ship in a migration that
        // may not have run yet in every environment — fall back to defaults
        // rather than failing the whole context call (visibility_scope is
        // still correct and far more important to return successfully).
        log_error(error);
      }
    }

    return res.status(200).send(new ServerResponse(true, {
      visibility_scope: {
        team_wide: visibilityScope.teamWide,
        is_team_lead: visibilityScope.isTeamLead,
        is_pm_anywhere: visibilityScope.isProjectManagerAnywhere,
        has_expanded_scope: visibilityScope.hasExpandedScope,
      },
      preferences,
    }));
  }

  @HandleExceptions()
  public static async getMyFilterOptions(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    // Distinct task-status names within this viewer's resolved scope, deduped
    // by lowercased name — status_id is project-scoped (every project defines
    // its own "To Do"/"Doing"/"Done" rows), mirroring the same dedupe-by-name
    // approach as Home > My Tasks' own filter-options endpoint
    // (HomePageController.getTaskFilterOptions). Deliberately not
    // date/project/search filtered — this lists every status the viewer
    // could ever filter to, not just what's in the current result page.
    const params: any[] = [req.user?.id, req.user?.team_id];
    const visibilityScope = await resolveTimeEntriesVisibilityScope(req);
    const scopePredicate = buildTimeEntriesScopePredicate(req.query.scope as string, 1, "t1.project_id", visibilityScope, params);

    const q = `
      SELECT MIN(ts.name) AS name
      FROM task_work_log twl
      INNER JOIN tasks t1 ON twl.task_id = t1.id
      INNER JOIN projects pr ON t1.project_id = pr.id
      INNER JOIN task_statuses ts ON t1.status_id = ts.id
      WHERE ${scopePredicate.clause}
        AND pr.team_id = $2
        AND t1.archived = FALSE
        -- Same rule as the entry feed: projects the viewer archived never surface, so
        -- their statuses shouldn't be offered. This also keeps $1 (the user id)
        -- referenced: for a team-wide viewer (Owner/Admin, scope=all) the scope
        -- predicate is a bare TRUE, and a parameter that no expression references
        -- makes Postgres fail with 42P18 "could not determine data type of parameter $1".
        AND NOT EXISTS (SELECT 1 FROM archived_projects ap WHERE ap.project_id = pr.id AND ap.user_id = $1)
      GROUP BY LOWER(ts.name)
      ORDER BY MIN(ts.name);
    `;
    const result = await db.query(q, params);
    return res.status(200).send(new ServerResponse(true, { statuses: result.rows }));
  }

  @HandleExceptions()
  public static async updateMyPreferences(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    // Values are already validated by timeEntriesPreferenceValidator.
    const teamMemberId = req.user?.team_member_id;
    const updates: string[] = [];
    const params: any[] = [];
    let i = 1;

    if (req.body.group_by) {
      updates.push(`time_entries_group_by = $${i++}`);
      params.push(req.body.group_by);
    }
    if (req.body.scope) {
      updates.push(`time_entries_scope = $${i++}`);
      params.push(req.body.scope);
    }

    if (!updates.length) {
      return res.status(200).send(new ServerResponse(true, null));
    }

    params.push(teamMemberId);
    const q = `UPDATE team_members SET ${updates.join(", ")} WHERE id = $${i}`;
    await db.query(q, params);

    return res.status(200).send(new ServerResponse(true, null));
  }

  private static escapeCsvValue(value: unknown): string {
    return sanitizeCsvValue(value);
  }

  private static formatSecondsForExport(seconds: number): string {
    const total = Math.max(0, Math.round(seconds || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    return `${h}:${String(m).padStart(2, "0")}`;
  }

  @HandleExceptions()
  public static async exportMyTimeLogEntriesCsv(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<void> {
    // Two export modes, both still governed by the viewer's resolved
    // visibility scope (never trusted from the client):
    //  - "filtered" (default): exactly the table on screen — the same
    //    filters and sort order as getMyTimeLogEntries, across every page. In
    //    the table's "By task" view (`view=task`) that means one row per task
    //    with its time summed, not the individual entries behind it.
    //  - "all": every individual entry within the viewer's scope, ignoring the
    //    narrowing filters (date range, project, search, person, client, ...)
    //    and the table view.
    const {
      mode, date_filter, project_id, search, date_from, date_to, scope, person_id, client_id,
      status, priority_id, billable, view, sort_field, sort_order,
    } = req.query as Record<string, string>;
    const isFilteredMode = mode !== "all";
    const isTaskView = isFilteredMode && view === "task";

    const params: any[] = [req.user?.id, req.user?.team_id];
    const visibilityScope = await resolveTimeEntriesVisibilityScope(req);
    const scopePredicate = buildTimeEntriesScopePredicate(scope, 1, "t1.project_id", visibilityScope, params);

    const conditions: string[] = [
      scopePredicate.clause,
      `pr.team_id = $2`,
      `t1.archived = FALSE`,
      `NOT EXISTS (SELECT 1 FROM archived_projects ap WHERE ap.project_id = pr.id AND ap.user_id = $1)`,
    ];
    let idx = scopePredicate.nextParamIdx;

    if (isFilteredMode) {
      const activeFilter = date_filter || "this_week";
      if (activeFilter === "no_logged_time") {
        // "No logged time" describes tasks, not log entries — never matches an export row.
        conditions.push("FALSE");
      } else if (activeFilter === "custom" && date_from && date_to) {
        // Plain timestamptz range comparisons (no ::date cast) so the
        // planner can use idx_task_work_log_user_created_at as a genuine
        // index range condition — see the same rewrite in getMyTimeLogEntries.
        conditions.push(`twl.created_at >= $${idx}::date AND twl.created_at < ($${idx + 1}::date + INTERVAL '1 day')`);
        params.push(date_from, date_to);
        idx += 2;
      } else if (activeFilter === "yesterday") {
        conditions.push(`twl.created_at >= (CURRENT_DATE - INTERVAL '1 day') AND twl.created_at < CURRENT_DATE`);
      } else if (activeFilter === "last_week") {
        conditions.push(`twl.created_at >= (CURRENT_DATE - INTERVAL '7 days') AND twl.created_at < CURRENT_DATE`);
      } else if (activeFilter === "today") {
        conditions.push(`twl.created_at >= CURRENT_DATE AND twl.created_at < CURRENT_DATE + INTERVAL '1 day'`);
      } else if (activeFilter === "this_week") {
        conditions.push(`twl.created_at >= date_trunc('week', CURRENT_DATE) AND twl.created_at < CURRENT_DATE + INTERVAL '1 day'`);
      }

      if (project_id) {
        const projectIds = project_id.split(",").filter(Boolean);
        if (projectIds.length) {
          conditions.push(`t1.project_id = ANY($${idx}::uuid[])`);
          params.push(projectIds);
          idx++;
        }
      }

      if (search) {
        conditions.push(`(t1.name ILIKE $${idx} OR CAST(t1.task_no AS TEXT) = $${idx + 1} OR twl.description ILIKE $${idx})`);
        params.push(`%${search}%`, search);
        idx += 2;
      }

      const personIds = person_id ? person_id.split(",").filter(Boolean) : [];
      if (personIds.length) {
        conditions.push(`twl.user_id = ANY($${idx}::uuid[])`);
        params.push(personIds);
        idx++;
      }

      const clientIds = client_id ? client_id.split(",").filter(Boolean) : [];
      if (clientIds.length) {
        const hasNone = clientIds.includes("none");
        const realIds = clientIds.filter(id => id !== "none");
        const parts: string[] = [];
        if (realIds.length) {
          parts.push(`pr.client_id = ANY($${idx}::uuid[])`);
          params.push(realIds);
          idx++;
        }
        if (hasNone) parts.push(`pr.client_id IS NULL`);
        if (parts.length) conditions.push(`(${parts.join(" OR ")})`);
      }

      if (status) {
        const statusNames = status.split(",").filter(Boolean).map(s => s.toLowerCase());
        if (statusNames.length) {
          conditions.push(`LOWER(ts.name) = ANY($${idx}::text[])`);
          params.push(statusNames);
          idx++;
        }
      }

      if (priority_id) {
        const priorityIds = priority_id.split(",").filter(Boolean);
        if (priorityIds.length) {
          conditions.push(`t1.priority_id = ANY($${idx}::uuid[])`);
          params.push(priorityIds);
          idx++;
        }
      }

      if (billable) {
        const billableValues = Array.from(new Set(billable.split(",").filter(Boolean)));
        if (billableValues.length === 1) {
          conditions.push(`t1.billable = $${idx}`);
          params.push(billableValues[0] === "true");
          idx++;
        }
      }
    }

    // Safety cap so a very large export can't exhaust memory or blow past a
    // reasonable response size — well beyond what's realistically reviewed
    // in a single spreadsheet.
    const limitIdx = idx;
    params.push(50000);

    // The table's own sort order in filtered mode; newest entries first otherwise.
    const orderBy = buildTimeLogOrderBy(isFilteredMode ? sort_field : undefined, isFilteredMode ? sort_order : undefined, isTaskView);

    const entryQuery = `
      SELECT
        twl.created_at,
        twl.time_spent,
        twl.description,
        (SELECT name FROM users WHERE users.id = twl.user_id) AS user_name,
        pr.name AS project_name,
        (SELECT name FROM clients WHERE id = pr.client_id) AS client_name,
        t1.name AS task_name,
        t1.task_no,
        ts.name AS status_name,
        tp.name AS priority_name,
        t1.billable,
        t1.end_date AS due_date
      FROM task_work_log twl
      INNER JOIN tasks t1 ON twl.task_id = t1.id
      INNER JOIN projects pr ON t1.project_id = pr.id
      LEFT JOIN task_statuses ts ON t1.status_id = ts.id
      LEFT JOIN task_priorities tp ON t1.priority_id = tp.id
      WHERE ${conditions.join(" AND ")}
      ORDER BY ${orderBy}
      LIMIT $${limitIdx};
    `;

    // "By task" view: same columns, one row per task — the same aggregation as
    // getMyTimeLogEntries' `view=task` (time summed, latest entry date,
    // non-empty descriptions joined newest-first), with the distinct members
    // as names since a spreadsheet cell can't hold avatars.
    const taskViewQuery = `
      SELECT
        MAX(twl.created_at) AS created_at,
        COALESCE(SUM(twl.time_spent), 0)::FLOAT8 AS time_spent,
        STRING_AGG(NULLIF(BTRIM(twl.description), ''), ' • ' ORDER BY twl.created_at DESC) AS description,
        STRING_AGG(DISTINCT u.name, '; ' ORDER BY u.name) AS user_name,
        pr.name AS project_name,
        c.name AS client_name,
        t1.name AS task_name,
        t1.task_no,
        ts.name AS status_name,
        tp.name AS priority_name,
        t1.billable,
        t1.end_date AS due_date
      FROM task_work_log twl
      INNER JOIN tasks t1 ON twl.task_id = t1.id
      INNER JOIN projects pr ON t1.project_id = pr.id
      LEFT JOIN users u ON u.id = twl.user_id
      LEFT JOIN clients c ON c.id = pr.client_id
      LEFT JOIN task_statuses ts ON t1.status_id = ts.id
      LEFT JOIN task_priorities tp ON t1.priority_id = tp.id
      WHERE ${conditions.join(" AND ")}
      GROUP BY
        t1.id, t1.name, t1.task_no, t1.billable, t1.end_date,
        pr.id, pr.name,
        c.id, c.name,
        ts.name, tp.name
      ORDER BY ${orderBy}
      LIMIT $${limitIdx};
    `;

    const q = isTaskView ? taskViewQuery : entryQuery;
    const result = await db.query(q, params);

    // "Logged On" is the calendar day the time was logged, as the user sees it
    // in the table — so it's formatted in their own timezone, not the server's.
    const timeZone = req.user?.timezone_name;
    const formatLoggedOn = (value: Date | string): string =>
      (timeZone ? momentTime.tz(value, timeZone) : moment(value)).format("YYYY-MM-DD");

    const csvRows: string[] = [];
    csvRows.push(
      ["Logged On", "Member", "Task", "Task ID", "Project", "Client", "Status", "Priority", "Billable", "Description", "Time Logged", "Due Date"]
        .map(h => `"${h}"`)
        .join(",")
    );

    for (const row of result.rows) {
      csvRows.push(
        [
          row.created_at ? formatLoggedOn(row.created_at) : "",
          row.user_name,
          row.task_name,
          row.task_no != null ? `#${row.task_no}` : "",
          row.project_name,
          row.client_name,
          row.status_name,
          row.priority_name,
          row.billable ? "Yes" : "No",
          row.description,
          this.formatSecondsForExport(row.time_spent),
          row.due_date ? moment(row.due_date).format("YYYY-MM-DD") : "",
        ]
          .map(v => `"${this.escapeCsvValue(v)}"`)
          .join(",")
      );
    }

    const csvContent = csvRows.join("\n");
    const fileName = `time-entries-${moment().format("YYYY-MM-DD-HHmmss")}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    // BOM for Excel compatibility, matching the existing reporting CSV exports.
    res.write("﻿" + csvContent);
    res.end();
  }
}
