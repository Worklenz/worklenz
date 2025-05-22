import { CronJob } from "cron";
import { calculateNextEndDate, log_error } from "../shared/utils";
import db from "../config/db";
import { IRecurringSchedule, ITaskTemplate } from "../interfaces/recurring-tasks";
import moment from "moment";
import TasksController from "../controllers/tasks-controller";

// At 11:00+00 (4.30pm+530) on every day-of-month if it's on every day-of-week from Monday through Friday.
// const TIME = "0 11 */1 * 1-5";
const TIME = process.env.RECURRING_JOBS_INTERVAL || "0 11 */1 * 1-5";
const TIME_FORMAT = "YYYY-MM-DD";
// const TIME = "0 0 * * *"; // Runs at midnight every day

const log = (value: any) => console.log("recurring-task-cron-job:", value);

// Define future limits for different schedule types
// More conservative limits to prevent task list clutter
const FUTURE_LIMITS = {
  daily: moment.duration(3, "days"),
  weekly: moment.duration(1, "week"),
  monthly: moment.duration(1, "month"),
  every_x_days: (interval: number) => moment.duration(interval, "days"),
  every_x_weeks: (interval: number) => moment.duration(interval, "weeks"),
  every_x_months: (interval: number) => moment.duration(interval, "months")
};

// Helper function to get the future limit based on schedule type
function getFutureLimit(scheduleType: string, interval?: number): moment.Duration {
  switch (scheduleType) {
    case "daily":
      return FUTURE_LIMITS.daily;
    case "weekly":
      return FUTURE_LIMITS.weekly;
    case "monthly":
      return FUTURE_LIMITS.monthly;
    case "every_x_days":
      return FUTURE_LIMITS.every_x_days(interval || 1);
    case "every_x_weeks":
      return FUTURE_LIMITS.every_x_weeks(interval || 1);
    case "every_x_months":
      return FUTURE_LIMITS.every_x_months(interval || 1);
    default:
      return moment.duration(3, "days"); // Default to 3 days
  }
}

// Helper function to batch create tasks
async function createBatchTasks(template: ITaskTemplate & IRecurringSchedule, endDates: moment.Moment[]) {
  const createdTasks = [];
  
  for (const nextEndDate of endDates) {
    const existingTaskQuery = `
      SELECT id FROM tasks 
      WHERE schedule_id = $1 AND end_date::DATE = $2::DATE;
    `;
    const existingTaskResult = await db.query(existingTaskQuery, [template.schedule_id, nextEndDate.format(TIME_FORMAT)]);

    if (existingTaskResult.rows.length === 0) {
      const createTaskQuery = `SELECT create_quick_task($1::json) as task;`;
      const taskData = {
        name: template.name,
        priority_id: template.priority_id,
        project_id: template.project_id,
        reporter_id: template.reporter_id,
        status_id: template.status_id || null,
        end_date: nextEndDate.format(TIME_FORMAT),
        schedule_id: template.schedule_id
      };
      const createTaskResult = await db.query(createTaskQuery, [JSON.stringify(taskData)]);
      const createdTask = createTaskResult.rows[0].task;

      if (createdTask) {
        createdTasks.push(createdTask);

        for (const assignee of template.assignees) {
          await TasksController.createTaskBulkAssignees(assignee.team_member_id, template.project_id, createdTask.id, assignee.assigned_by); 
        }

        for (const label of template.labels) {
          const q = `SELECT add_or_remove_task_label($1, $2) AS labels;`;
          await db.query(q, [createdTask.id, label.label_id]);
        }
        
        console.log(`Created task for template ${template.name} with end date ${nextEndDate.format(TIME_FORMAT)}`);
      }
    } else {
      console.log(`Skipped creating task for template ${template.name} with end date ${nextEndDate.format(TIME_FORMAT)} - task already exists`);
    }
  }

  return createdTasks;
}

async function onRecurringTaskJobTick() {
    try {
        log("(cron) Recurring tasks job started.");

        const templatesQuery = `
            SELECT t.*, s.*, (SELECT MAX(end_date) FROM tasks WHERE schedule_id = s.id) as last_task_end_date
            FROM task_recurring_templates t
            JOIN task_recurring_schedules s ON t.schedule_id = s.id;
        `;
        const templatesResult = await db.query(templatesQuery);
        const templates = templatesResult.rows as (ITaskTemplate & IRecurringSchedule)[];

        const now = moment();
        let createdTaskCount = 0;

        for (const template of templates) {
            const lastTaskEndDate = template.last_task_end_date 
                ? moment(template.last_task_end_date)
                : moment(template.created_at);
            
            // Calculate future limit based on schedule type
            const futureLimit = moment(template.last_checked_at || template.created_at)
                .add(getFutureLimit(
                    template.schedule_type,
                    template.interval_days || template.interval_weeks || template.interval_months || 1
                ));

            let nextEndDate = calculateNextEndDate(template, lastTaskEndDate);
            const endDatesToCreate: moment.Moment[] = [];

            // Find all future occurrences within the limit
            while (nextEndDate.isSameOrBefore(futureLimit)) {
                if (nextEndDate.isAfter(now)) {
                    endDatesToCreate.push(moment(nextEndDate));
                }
                nextEndDate = calculateNextEndDate(template, nextEndDate);
            }

            // Batch create tasks for all future dates
            if (endDatesToCreate.length > 0) {
                const createdTasks = await createBatchTasks(template, endDatesToCreate);
                createdTaskCount += createdTasks.length;

                // Update the last_checked_at in the schedule
                const updateScheduleQuery = `
                    UPDATE task_recurring_schedules 
                    SET last_checked_at = $1::DATE, 
                        last_created_task_end_date = $2 
                    WHERE id = $3;
                `;
                await db.query(updateScheduleQuery, [
                    moment().format(TIME_FORMAT),
                    endDatesToCreate[endDatesToCreate.length - 1].format(TIME_FORMAT),
                    template.schedule_id
                ]);
            } else {
                console.log(`No tasks created for template ${template.name} - next occurrence is beyond the future limit`);
            }
        }
        
        log(`(cron) Recurring tasks job ended with ${createdTaskCount} new tasks created.`);
    } catch (error) {
        log_error(error);
        log("(cron) Recurring task job ended with errors.");
    }
}

export function startRecurringTasksJob() {
    log("(cron) Recurring task job ready.");
    const job = new CronJob(
        TIME,
        () => void onRecurringTaskJobTick(),
        () => log("(cron) Recurring task job successfully executed."),
        true
    );
    job.start();
}