import db from "../config/db";

import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import { calculateNextEndDate, log_error } from "../shared/utils";

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
                    created_at
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
  public static async createTaskSchedule(taskId: string) {
    const q = `INSERT INTO task_recurring_schedules (schedule_type) VALUES ('daily') RETURNING id, schedule_type;`;
    const result = await db.query(q, []);
    const [data] = result.rows;

    const updateQ = `UPDATE tasks SET schedule_id = $1 WHERE id = $2;`;
    await db.query(updateQ, [data.id, taskId]);

    await TaskRecurringController.insertTaskRecurringTemplate(taskId, data.id);

    return data;
  }

  @HandleExceptions()
  public static async removeTaskSchedule(scheduleId: string) {
    const deleteQ = `DELETE FROM task_recurring_schedules WHERE id = $1;`;
    await db.query(deleteQ, [scheduleId]);
  }

  @HandleExceptions()
  public static async updateSchedule(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const { schedule_type, days_of_week, day_of_month, week_of_month, interval_days, interval_weeks, interval_months, date_of_month } = req.body;

    const deleteQ = `UPDATE task_recurring_schedules
                      SET schedule_type   = $1,
                          days_of_week    = $2,
                          date_of_month   = $3,
                          day_of_month    = $4,
                          week_of_month   = $5,
                          interval_days   = $6,
                          interval_weeks  = $7,
                          interval_months = $8
                      WHERE id = $9;`;
    await db.query(deleteQ, [schedule_type, days_of_week, date_of_month, day_of_month, week_of_month, interval_days, interval_weeks, interval_months, id]);
    return res.status(200).send(new ServerResponse(true, null));
  }

  // Function to create the next task in the recurring schedule
  private static async createNextRecurringTask(scheduleId: string, lastTask: any, taskTemplate: any) {
    try {
      const q = "SELECT * FROM task_recurring_schedules WHERE id = $1";
      const { rows: schedules } = await db.query(q, [scheduleId]);

      if (schedules.length === 0) {
        log_error("No schedule found");
        return;
      }

      const [schedule] = schedules;

      // Define the next start date based on the schedule
      const nextStartDate = calculateNextEndDate(schedule, lastTask.start_date);

      const result = await db.query(
        `INSERT INTO tasks (name, start_date, end_date, priority_id, project_id, reporter_id, description, total_minutes, status_id, schedule_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id;`,
        [
          taskTemplate.name, nextStartDate, null, taskTemplate.priority_id,
          lastTask.project_id, lastTask.reporter_id, taskTemplate.description,
          0, taskTemplate.status_id, scheduleId
        ]
      );
      const [data] = result.rows;

      log_error(`Next task created with id: ${data.id}`);

    } catch (error) {
      log_error("Error creating next recurring task:", error);
    }
  }
}