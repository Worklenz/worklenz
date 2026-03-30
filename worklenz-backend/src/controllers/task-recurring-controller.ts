import db from "../config/db";

import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";

const VALID_SCHEDULE_TYPES = ["daily", "weekly", "monthly", "yearly", "every_x_days", "every_x_weeks", "every_x_months"];

export default class TaskRecurringController extends WorklenzControllerBase {
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