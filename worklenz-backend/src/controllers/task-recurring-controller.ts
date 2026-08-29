import db from "../config/db";

import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import { SqlHelper } from "../shared/sql-helpers";

const VALID_SCHEDULE_TYPES = ["daily", "weekly", "monthly", "yearly", "every_x_days", "every_x_weeks", "every_x_months"];

const SORT_COLUMN_MAP: Record<string, string> = {
  name: "tasks.name",
  project: "p.name",
  start_date: "trs.start_date",
  end_date: "trs.end_date",
  est_time: "tasks.total_minutes",
  priority: "tp.value",
  recur_type: "trs.recurring_mode",
};

function parseCsvParam(value: unknown): string[] {
  if (!value || typeof value !== "string") return [];
  return value.split(",").map(v => v.trim()).filter(Boolean);
}

export default class TaskRecurringController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async getTeamRecurringTasks(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const userId = req.user?.id;
    let paramOffset = 2;
    const queryParams: any[] = [req.user?.team_id || null];

    let filterByMember = "";
    if (!req.user?.owner && !req.user?.is_admin) {
      queryParams.push(userId);
      filterByMember = ` AND is_member_of_project(p.id, $${paramOffset}, $1) `;
      paramOffset++;
    }

    let projectFilter = "";
    const projectIds = parseCsvParam(req.query.project_id);
    if (projectIds.length) {
      const { clause } = SqlHelper.buildInClause(projectIds, paramOffset);
      projectFilter = ` AND p.id IN (${clause}) `;
      queryParams.push(...projectIds);
      paramOffset += projectIds.length;
    }

    let assigneeFilter = "";
    const assigneeIds = parseCsvParam(req.query.team_member_id);
    if (assigneeIds.length) {
      const { clause } = SqlHelper.buildInClause(assigneeIds, paramOffset);
      assigneeFilter = ` AND EXISTS(SELECT 1 FROM tasks_assignees ta WHERE ta.task_id = tasks.id AND ta.team_member_id IN (${clause})) `;
      queryParams.push(...assigneeIds);
      paramOffset += assigneeIds.length;
    }

    let recurringModeFilter = "";
    const recurringModes = parseCsvParam(req.query.recurring_mode).filter(v => ["create_task", "change_status"].includes(v));
    if (recurringModes.length) {
      const { clause } = SqlHelper.buildInClause(recurringModes, paramOffset);
      recurringModeFilter = ` AND trs.recurring_mode IN (${clause}) `;
      queryParams.push(...recurringModes);
      paramOffset += recurringModes.length;
    }

    let scheduleTypeFilter = "";
    const scheduleTypes = parseCsvParam(req.query.schedule_type).filter(v => VALID_SCHEDULE_TYPES.includes(v));
    if (scheduleTypes.length) {
      const { clause } = SqlHelper.buildInClause(scheduleTypes, paramOffset);
      scheduleTypeFilter = ` AND trs.schedule_type IN (${clause}) `;
      queryParams.push(...scheduleTypes);
      paramOffset += scheduleTypes.length;
    }

    let priorityFilter = "";
    const priorityIds = parseCsvParam(req.query.priority_id);
    if (priorityIds.length) {
      const { clause } = SqlHelper.buildInClause(priorityIds, paramOffset);
      priorityFilter = ` AND tasks.priority_id IN (${clause}) `;
      queryParams.push(...priorityIds);
      paramOffset += priorityIds.length;
    }

    const {searchQuery, searchParams, sortField, sortOrder, size, offset} = this.toPaginationOptions(req.query, ["tasks.name"], false, paramOffset);
    if (searchParams.length > 0) {
      queryParams.push(...searchParams);
      paramOffset += searchParams.length;
    }

    const orderColumn = SORT_COLUMN_MAP[sortField as string] || "tasks.name";
    const orderDirection = sortOrder === "desc" ? "DESC" : "ASC";

    const limitParam = paramOffset;
    const offsetParam = paramOffset + 1;
    queryParams.push(size, offset);

    const q = `
      SELECT ROW_TO_JSON(rec) AS recurring_tasks
      FROM (SELECT COUNT(*) AS total,
                   (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t))), '[]'::JSON)
                    FROM (SELECT tasks.id,
                                 tasks.name,
                                 CONCAT(p.key, '-', tasks.task_no) AS task_key,
                                 tasks.total_minutes,
                                 p.id AS project_id,
                                 p.name AS project_name,
                                 p.color_code AS project_color,
                                 tasks.priority_id,
                                 tp.name AS priority_name,
                                 tp.color_code AS priority_color,
                                 tp.color_code_dark AS priority_color_dark,
                                 (SELECT get_task_assignees(tasks.id)) AS assignees,
                                 trs.id AS schedule_id,
                                 trs.schedule_type,
                                 trs.days_of_week,
                                 trs.day_of_month,
                                 trs.date_of_month,
                                 trs.week_of_month,
                                 trs.interval_days,
                                 trs.interval_weeks,
                                 trs.interval_months,
                                 trs.is_active,
                                 trs.start_date,
                                 trs.end_date,
                                 trs.recurring_mode
                          FROM tasks
                                 INNER JOIN task_recurring_schedules trs ON tasks.schedule_id = trs.id
                                 INNER JOIN projects p ON tasks.project_id = p.id
                                 INNER JOIN task_priorities tp ON tasks.priority_id = tp.id
                          WHERE tasks.archived IS FALSE
                            AND p.team_id = $1
                            ${filterByMember} ${projectFilter} ${assigneeFilter} ${recurringModeFilter} ${scheduleTypeFilter} ${priorityFilter} ${searchQuery}
                          ORDER BY ${orderColumn} ${orderDirection} NULLS LAST
                          LIMIT $${limitParam} OFFSET $${offsetParam}) t) AS data
            FROM tasks
                   INNER JOIN task_recurring_schedules trs ON tasks.schedule_id = trs.id
                   INNER JOIN projects p ON tasks.project_id = p.id
            WHERE tasks.archived IS FALSE
              AND p.team_id = $1
              ${filterByMember} ${projectFilter} ${assigneeFilter} ${recurringModeFilter} ${scheduleTypeFilter} ${priorityFilter} ${searchQuery}) rec;
    `;

    const result = await db.query(q, queryParams);
    const [row] = result.rows;
    const data = row?.recurring_tasks?.data || [];
    const total = row?.recurring_tasks?.total || 0;

    for (const item of data) {
      const totalMinutes = Number(item.total_minutes) || 0;
      item.est_time_string = `${~~(totalMinutes / 60)}h ${totalMinutes % 60}m`;
    }

    return res.status(200).send(new ServerResponse(true, {total: Number(total), data}));
  }

  @HandleExceptions()
  public static async getById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const q = `SELECT id,
                    schedule_type,
                    days_of_week,
                    date_of_month,
                    day_of_month,
                    week_of_month,
                    interval_days,
                    interval_weeks,
                    interval_months,
                    is_active,
                    max_occurrences,
                    occurrence_count,
                    start_date,
                    end_date,
                    timezone_id,
                    created_by,
                    last_checked_at,
                    last_created_task_end_date,
                    created_at,
                    recurring_mode,
                    target_status_id
              FROM task_recurring_schedules WHERE id = $1;`;
    const result = await db.query(q, [id]);
    const [data] = result.rows;

    return res.status(200).send(new ServerResponse(true, data));
  }

  private static async insertTaskRecurringTemplate(taskId: string, scheduleId: string) {
    const q = `SELECT create_recurring_task_template($1, $2);`;
    await db.query(q, [taskId, scheduleId]);
  }

  @HandleExceptions()
  public static async createTaskSchedule(taskId: string, userId?: string | null) {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      // Resolve the user's timezone_id for timezone-aware scheduling
      let timezoneId: string | null = null;
      if (userId) {
        const tzResult = await client.query(`SELECT timezone_id FROM users WHERE id = $1;`, [userId]);
        timezoneId = tzResult.rows[0]?.timezone_id || null;
      }

      const scheduleResult = await client.query(
        `INSERT INTO task_recurring_schedules (schedule_type, timezone_id, created_by) VALUES ('daily', $1, $2) RETURNING id, schedule_type;`,
        [timezoneId, userId]
      );
      const [data] = scheduleResult.rows;

      await client.query(
        `UPDATE tasks SET schedule_id = $1 WHERE id = $2;`,
        [data.id, taskId]
      );

      await client.query(
        `SELECT create_recurring_task_template($1, $2);`,
        [taskId, data.id]
      );

      await client.query("COMMIT");
      return data;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  @HandleExceptions()
  public static async removeTaskSchedule(scheduleId: string) {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `UPDATE tasks SET schedule_id = NULL WHERE schedule_id = $1;`,
        [scheduleId]
      );

      await client.query(
        `DELETE FROM task_recurring_schedules WHERE id = $1;`,
        [scheduleId]
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  @HandleExceptions()
  public static async updateSchedule(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const { 
      schedule_type, 
      days_of_week, 
      day_of_month, 
      week_of_month, 
      interval_days, 
      interval_weeks, 
      interval_months, 
      date_of_month, 
      start_date, 
      end_date, 
      max_occurrences,
      recurring_mode,
      target_status_id
    } = req.body;

    // Input validation
    if (schedule_type && !VALID_SCHEDULE_TYPES.includes(schedule_type)) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid schedule type."));
    }

    if (start_date && end_date && new Date(start_date) > new Date(end_date)) {
      return res.status(400).send(new ServerResponse(false, null, "start_date must be before end_date."));
    }

    if (days_of_week && Array.isArray(days_of_week)) {
      const isValid = days_of_week.every((d: number) => Number.isInteger(d) && d >= 0 && d <= 6);
      if (!isValid) {
        return res.status(400).send(new ServerResponse(false, null, "days_of_week values must be integers between 0 and 6."));
      }
    }

    if (date_of_month != null && (date_of_month < 1 || date_of_month > 28)) {
      return res.status(400).send(new ServerResponse(false, null, "date_of_month must be between 1 and 28."));
    }

    if (day_of_month != null && (day_of_month < 0 || day_of_month > 6)) {
      return res.status(400).send(new ServerResponse(false, null, "day_of_month must be between 0 and 6."));
    }

    if (week_of_month != null && (week_of_month < 1 || week_of_month > 5)) {
      return res.status(400).send(new ServerResponse(false, null, "week_of_month must be between 1 and 5."));
    }

    if (interval_days != null && (interval_days < 1 || interval_days > 365)) {
      return res.status(400).send(new ServerResponse(false, null, "interval_days must be between 1 and 365."));
    }

    if (interval_weeks != null && (interval_weeks < 1 || interval_weeks > 52)) {
      return res.status(400).send(new ServerResponse(false, null, "interval_weeks must be between 1 and 52."));
    }

    if (interval_months != null && (interval_months < 1 || interval_months > 12)) {
      return res.status(400).send(new ServerResponse(false, null, "interval_months must be between 1 and 12."));
    }

    if (max_occurrences != null && (max_occurrences < 1 || max_occurrences > 1000)) {
      return res.status(400).send(new ServerResponse(false, null, "max_occurrences must be between 1 and 1000."));
    }

    if (recurring_mode && !['create_task', 'change_status'].includes(recurring_mode)) {
      return res.status(400).send(new ServerResponse(false, null, "recurring_mode must be 'create_task' or 'change_status'."));
    }

    // Wrap in transaction to prevent race conditions with cron job
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      const q = `UPDATE task_recurring_schedules
                  SET schedule_type    = $1,
                      days_of_week     = $2,
                      date_of_month    = $3,
                      day_of_month     = $4,
                      week_of_month    = $5,
                      interval_days    = $6,
                      interval_weeks   = $7,
                      interval_months  = $8,
                      start_date       = $9,
                      end_date         = $10,
                      max_occurrences  = $11,
                      recurring_mode   = $12,
                      target_status_id = $13
                  WHERE id = $14;`;
      await client.query(q, [
        schedule_type,
        days_of_week || null,
        date_of_month || null,
        day_of_month || null,
        week_of_month || null,
        interval_days || null,
        interval_weeks || null,
        interval_months || null,
        start_date || null,
        end_date || null,
        max_occurrences || null,
        recurring_mode || 'create_task',
        target_status_id || null,
        id
      ]);

      await client.query("COMMIT");
      return res.status(200).send(new ServerResponse(true, null));
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}