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

    // Fetch the old task_id before updating so we can notify both tasks via socket
    const oldTaskRes = await db.query(
      `SELECT task_id FROM task_work_log WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user?.id]
    );
    const oldTaskId: string | undefined = oldTaskRes.rows[0]?.task_id;

    // If new_task_id is provided and differs from the current task, move the log
    const targetTaskId = new_task_id || oldTaskId;

    const q = `
      UPDATE task_work_log
      SET time_spent  = $3,
          description = $4,
          created_at  = $5,
          task_id = $6
      WHERE id = $1
        AND user_id = $2
      RETURNING task_id;
    `;
    const params = [
      req.params.id,
      req.user?.id,
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
    const q = `DELETE
               FROM task_work_log
               WHERE id = $1
                 AND task_id = $2
                 AND user_id = $3
               RETURNING task_id;`;
    const result = await db.query(q, [
      req.params.id,
      req.query.task,
      req.user?.id,
    ]);
    const [data] = result.rows;

    await this.emitTaskTimeLogUpdated(req.user?.team_id, data?.task_id);

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
      extraConditions.push(`t.project_id = $${paramIdx}::uuid`);
      extraParams.push(project_id);
      paramIdx++;
    }

    const activeFilter = date_filter || "today";

    // Tasks must have logged time in the period -> require a non-zero total.
    const hasLoggedTimeHaving = `HAVING COALESCE(SUM(twl.time_spent), 0) > 0`;

    let logDateCondition = "";
    let logHaving = hasLoggedTimeHaving;

    if (activeFilter === "custom" && date_from && date_to) {
      logDateCondition = `twl.created_at::date BETWEEN $${paramIdx}::date AND $${paramIdx + 1}::date`;
      extraParams.push(date_from, date_to);
      paramIdx += 2;
    } else {
      switch (activeFilter) {
        case "yesterday":
          logDateCondition = `twl.created_at::date = (CURRENT_DATE - INTERVAL '1 day')::date`;
          break;
        case "last_week":
          logDateCondition = `twl.created_at::date >= (CURRENT_DATE - INTERVAL '7 days')::date AND twl.created_at::date < CURRENT_DATE`;
          break;
        case "no_logged_time":
          // Join ALL of the user's logs, keep tasks with zero total time.
          logDateCondition = "";
          logHaving = `HAVING COALESCE(SUM(twl.time_spent), 0) = 0`;
          break;
        default:
          logDateCondition = `twl.created_at::date = CURRENT_DATE`;
      }
    }

    if (activeFilter === "today") {
      const todayQ = buildQuery(`twl.created_at::date = CURRENT_DATE`, hasLoggedTimeHaving, extraParams, extraConditions, page, pageSize);
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
      WHERE twl.user_id = $1
        AND p.team_id = $2;
    `;
    const result = await db.query(q, [req.user?.id, req.user?.team_id]);
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
      )
      SELECT
        d.day::text AS day,
        COALESCE(SUM(twl.time_spent) FILTER (WHERE p.id IS NOT NULL AND t.billable IS TRUE), 0) AS billable,
        COALESCE(SUM(twl.time_spent) FILTER (WHERE p.id IS NOT NULL AND t.billable IS FALSE), 0) AS non_billable
      FROM days d
      CROSS JOIN user_tz
      LEFT JOIN task_work_log twl
        ON twl.user_id = $1
        AND (twl.created_at AT TIME ZONE 'UTC' + user_tz.tz_offset)::date = d.day
      LEFT JOIN tasks t ON t.id = twl.task_id
      LEFT JOIN projects p ON p.id = t.project_id AND p.team_id = $2
      GROUP BY d.day
      ORDER BY d.day;
    `;
    const result = await db.query(q, [req.user?.id, req.user?.team_id]);
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
        tsc.color_code AS status_color,
        tsc.color_code_dark AS status_color_dark,
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
    const { date_filter, project_id, search, date_from, date_to, sort_field, sort_order } =
      req.query as Record<string, string>;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.page_size as string, 10) || 20));
    const offset = (page - 1) * pageSize;

    const activeFilter = date_filter || "today";

    // "No logged time" describes tasks, not log entries — every row here is
    // already a logged entry, so that filter can never match anything.
    if (activeFilter === "no_logged_time") {
      return res.status(200).send(new ServerResponse(true, { logs: [], total: 0 }));
    }

    const params: any[] = [req.user?.id, req.user?.team_id];
    const conditions: string[] = [
      `twl.user_id = $1`,
      `pr.team_id = $2`,
      `t1.archived = FALSE`,
      `NOT EXISTS (SELECT 1 FROM archived_projects ap WHERE ap.project_id = pr.id AND ap.user_id = $1)`,
    ];
    let idx = 3;

    if (activeFilter === "custom" && date_from && date_to) {
      conditions.push(`twl.created_at::date BETWEEN $${idx}::date AND $${idx + 1}::date`);
      params.push(date_from, date_to);
      idx += 2;
    } else if (activeFilter === "yesterday") {
      conditions.push(`twl.created_at::date = (CURRENT_DATE - INTERVAL '1 day')::date`);
    } else if (activeFilter === "last_week") {
      conditions.push(`twl.created_at::date >= (CURRENT_DATE - INTERVAL '7 days')::date AND twl.created_at::date < CURRENT_DATE`);
    } else if (activeFilter === "today") {
      conditions.push(`twl.created_at::date = CURRENT_DATE`);
    }
    // Any other value (e.g. a future "all time" option) is left unfiltered by date.

    if (project_id) {
      conditions.push(`t1.project_id = $${idx}::uuid`);
      params.push(project_id);
      idx++;
    }

    if (search) {
      conditions.push(`(t1.name ILIKE $${idx} OR CAST(t1.task_no AS TEXT) = $${idx + 1})`);
      params.push(`%${search}%`, search);
      idx += 2;
    }

    const sortColumns: Record<string, string> = {
      task_name: "t1.name",
      project_name: "pr.name",
      priority_name: "tp.name",
      time_spent: "twl.time_spent",
      created_at: "twl.created_at",
      due_date: "t1.end_date",
    };
    const sortColumn = sortColumns[sort_field as string] || "twl.created_at";
    const sortDir = (sort_order || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
    // Tasks with no due date should always sort to the end, in either direction —
    // otherwise DESC surfaces them first (Postgres treats NULL as the largest value).
    const nullsClause = sort_field === "due_date" ? " NULLS LAST" : "";

    const limitIdx = idx;
    const offsetIdx = idx + 1;
    params.push(pageSize, offset);

    const q = `
      SELECT
        twl.id,
        twl.task_id,
        twl.created_at,
        twl.time_spent,
        t1.name AS task_name,
        t1.billable,
        t1.end_date AS due_date,
        pr.id AS project_id,
        pr.name AS project_name,
        pr.color_code AS project_color,
        t1.parent_task_id,
        t2.name AS parent_task_name,
        ts.name AS status_name,
        tsc.color_code AS status_color,
        tsc.color_code_dark AS status_color_dark,
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
      ORDER BY ${sortColumn} ${sortDir}${nullsClause}
      LIMIT $${limitIdx} OFFSET $${offsetIdx};
    `;

    const result = await db.query(q, params);
    const total = result.rows[0]?.total_count ? parseInt(result.rows[0].total_count, 10) : 0;
    const logs = result.rows.map(({ total_count, ...rest }) => rest);
    return res.status(200).send(new ServerResponse(true, { logs, total }));
  }
}
