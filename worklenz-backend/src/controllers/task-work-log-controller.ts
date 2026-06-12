import Excel from "exceljs";
import moment from "moment";

import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";

import db from "../config/db";
import { formatDuration, getColor, toSeconds } from "../shared/utils";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import momentTime from "moment-timezone";
import { SocketEvents } from "../socket.io/events";
import { IO } from "../shared/io";

export default class TaskWorklogController extends WorklenzControllerBase {
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

    // Emit socket event to notify all clients about the time log update
    const io = IO.getInstance();
    if (io) {
      io.emit(SocketEvents.TASK_TIME_LOG_UPDATED.toString(), { task_id: id });
    }

    return res.status(200).send(new ServerResponse(true, data));
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
    const results = await this.getTimeLogs(
      req.params.id,
      req.query.time_zone_name as string,
    );

    for (const item of results) item.avatar_color = getColor(item.user_name);

    return res.status(200).send(new ServerResponse(true, results));
  }

  @HandleExceptions()
  public static async update(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    const { seconds_spent, description, created_at, formatted_start } =
      req.body;
    const q = `
      UPDATE task_work_log
      SET time_spent  = $3,
          description = $4,
          created_at  = $5
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
    ];
    const result = await db.query(q, params);
    const [data] = result.rows;

    // Emit socket event to notify all clients about the time log update
    if (data?.task_id) {
      const io = IO.getInstance();
      if (io) {
        io.emit(SocketEvents.TASK_TIME_LOG_UPDATED.toString(), {
          task_id: data.task_id,
        });
      }
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

    // Emit socket event to notify all clients about the time log deletion
    if (data?.task_id) {
      const io = IO.getInstance();
      if (io) {
        io.emit(SocketEvents.TASK_TIME_LOG_UPDATED.toString(), {
          task_id: data.task_id,
        });
      }
    }

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

    const buildQuery = (dateCondition: string, extraParams: any[], extraConditions: string[], havingClause: string, pg: number, pgSize: number) => {
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
        dateCondition,
        ...extraConditions,
      ];
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
        LEFT JOIN task_work_log twl ON twl.task_id = t.id AND twl.user_id = $3
        WHERE ${baseConditions.join(' AND ')}
        GROUP BY t.id, t.name, t.end_date, t.done, p.id, p.name, p.color_code
        ${havingClause}
        ORDER BY t.end_date ASC NULLS LAST
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

    if (activeFilter === "custom" && date_from && date_to) {
      extraConditions.push(`t.end_date::date BETWEEN $${paramIdx}::date AND $${paramIdx + 1}::date`);
      extraParams.push(date_from, date_to);
      paramIdx += 2;
    }

    const getDateCondition = (filter: string) => {
      switch (filter) {
        case "today":          return `t.end_date::date = CURRENT_DATE`;
        case "yesterday":      return `t.end_date::date = (CURRENT_DATE - INTERVAL '1 day')::date`;
        case "last_week":      return `t.end_date::date >= (CURRENT_DATE - INTERVAL '7 days')::date AND t.end_date::date < CURRENT_DATE`;
        case "overdue":        return `t.end_date IS NOT NULL AND t.end_date::date < CURRENT_DATE AND t.done = FALSE`;
        case "no_logged_time": return `TRUE`;
        case "custom":         return `TRUE`;
        default:               return `TRUE`;
      }
    };

    const noLoggedTimeHaving = activeFilter === "no_logged_time"
      ? `HAVING COALESCE(SUM(twl.time_spent), 0) = 0`
      : "";

    if (activeFilter === "today" && !search && !project_id) {
      const todayQ = buildQuery(`t.end_date::date = CURRENT_DATE`, extraParams, extraConditions, "", page, pageSize);
      let result = await db.query(todayQ.q, todayQ.params);
      let fallbackDate: string | null = null;

      if (result.rows.length === 0) {
        const yQ = buildQuery(`t.end_date::date = (CURRENT_DATE - INTERVAL '1 day')::date`, extraParams, extraConditions, "", page, pageSize);
        result = await db.query(yQ.q, yQ.params);

        if (result.rows.length === 0) {
          const recentQ = buildQuery(`t.end_date IS NOT NULL`, extraParams, extraConditions, "", page, pageSize);
          result = await db.query(recentQ.q, recentQ.params);
          if (result.rows.length > 0) fallbackDate = result.rows[0].due_date;
        } else {
          fallbackDate = "yesterday";
        }
      }

      const total = result.rows[0]?.total_count ? parseInt(result.rows[0].total_count) : 0;
      return res.status(200).send(new ServerResponse(true, { tasks: result.rows, fallback_date: fallbackDate, total }));
    }

    const { q, params } = buildQuery(getDateCondition(activeFilter), extraParams, extraConditions, noLoggedTimeHaving, page, pageSize);
    const result = await db.query(q, params);
    const total = result.rows[0]?.total_count ? parseInt(result.rows[0].total_count) : 0;
    return res.status(200).send(new ServerResponse(true, { tasks: result.rows, fallback_date: null, total }));
  }

  @HandleExceptions()
  public static async getMySummary(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    const q = `
      SELECT
        COALESCE(SUM(twl.time_spent) FILTER (WHERE twl.created_at::date = CURRENT_DATE), 0) AS today_total,
        COALESCE(SUM(twl.time_spent) FILTER (WHERE twl.created_at >= date_trunc('week', CURRENT_DATE)), 0) AS week_total
      FROM task_work_log twl
      JOIN tasks t ON twl.task_id = t.id
      JOIN projects p ON t.project_id = p.id
      WHERE twl.user_id = $1
        AND p.team_id = $2;
    `;
    const result = await db.query(q, [req.user?.id, req.user?.team_id]);
    return res.status(200).send(new ServerResponse(true, result.rows[0] || { today_total: 0, week_total: 0 }));
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

    const params: any[] = [project_id, req.user?.team_member_id];
    const conditions: string[] = [
      `t.project_id = $1::uuid`,
      `ta.team_member_id = $2`,
      `t.archived = FALSE`,
    ];

    if (search) {
      conditions.push(`(t.name ILIKE $3 OR CAST(t.task_no AS TEXT) = $4)`);
      params.push(`%${search}%`, search);
    }

    const q = `
      SELECT DISTINCT
        t.id,
        t.name,
        t.end_date AS due_date,
        t.task_no
      FROM tasks t
      JOIN tasks_assignees ta ON ta.task_id = t.id
      WHERE ${conditions.join(" AND ")}
      ORDER BY t.end_date ASC NULLS LAST
      LIMIT 50;
    `;
    const result = await db.query(q, params);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getRecentTimeLogs(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    const q = `
      SELECT 
        twl.task_id,
        twl.created_at,
        twl.time_spent,
        t1.name AS task_name,
        pr.id AS project_id,
        pr.name AS project_name,
        pr.color_code AS project_color,
        t1.parent_task_id,
        t2.name AS parent_task_name
      FROM task_work_log twl
      INNER JOIN tasks t1 ON twl.task_id = t1.id
      INNER JOIN projects pr ON t1.project_id = pr.id
      LEFT JOIN tasks t2 ON t1.parent_task_id = t2.id
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
      LIMIT 10;
    `;
    const params = [req.user?.id, req.user?.team_id];
    const result = await db.query(q, params);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }
}
