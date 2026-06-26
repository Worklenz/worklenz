import { CronJob } from "cron";
import { PoolClient } from "pg";
import { calculateNextEndDate, log_error } from "../shared/utils";
import db from "../config/db";
import { IRecurringSchedule, ITaskTemplate } from "../interfaces/recurring-tasks";
import moment from "moment-timezone";
import TasksController from "../controllers/tasks-controller";

const TIME = process.env.RECURRING_JOBS_INTERVAL || "0 11 * * *";
const TIME_FORMAT = "YYYY-MM-DD";

// Advisory lock ID for preventing concurrent cron execution across instances
const ADVISORY_LOCK_ID = 900100;

// Maximum number of tasks created per single cron tick (across all schedules)
const MAX_TASKS_PER_TICK = 50;

const log = (value: string) => console.log("recurring-task-cron-job:", value);

// Acquire a PostgreSQL advisory lock to prevent concurrent execution.
// IMPORTANT: pg_try_advisory_lock is SESSION-level — the lock belongs to the exact
// connection that ran it. The caller MUST keep using and release the lock on this
// same client; do NOT use the shared pool.query, which hands out arbitrary
// connections and would leak the lock (acquired on one connection, "released" on
// another), permanently blocking every subsequent tick.
async function acquireAdvisoryLock(client: PoolClient): Promise<boolean> {
  const result = await client.query("SELECT pg_try_advisory_lock($1) AS acquired;", [ADVISORY_LOCK_ID]);
  return result.rows[0]?.acquired === true;
}

// Release the advisory lock on the same client that acquired it.
async function releaseAdvisoryLock(client: PoolClient): Promise<void> {
  await client.query("SELECT pg_advisory_unlock($1);", [ADVISORY_LOCK_ID]);
}

// Create a single recurring task from a template
async function createSingleRecurringTask(
  template: ITaskTemplate & IRecurringSchedule,
  nextEndDate: moment.Moment
): Promise<boolean> {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    const createTaskQuery = `SELECT create_quick_task($1::json) as task;`;
    
    // Calculate start_date based on original task's duration
    let startDate = null;
    if (template.duration_days != null && template.duration_days > 0) {
      startDate = nextEndDate.clone().subtract(template.duration_days, 'days').format(TIME_FORMAT);
    }
    
    const taskData = {
      name: template.name,
      description: template.description || null,
      priority_id: template.priority_id,
      project_id: template.project_id,
      reporter_id: template.reporter_id || null,
      status_id: template.status_id || null,
      start_date: startDate,
      end_date: nextEndDate.format(TIME_FORMAT),
      schedule_id: template.schedule_id
    };

    const createTaskResult = await client.query(createTaskQuery, [JSON.stringify(taskData)]);
    const createdTask = createTaskResult.rows[0]?.task;

    if (!createdTask) {
      await client.query("ROLLBACK");
      return false;
    }

    // Assign team members
    if (template.assignees && Array.isArray(template.assignees)) {
      for (const assignee of template.assignees) {
        if (assignee.team_member_id && assignee.assigned_by) {
          const assignQuery = `SELECT create_bulk_task_assignees($1,$2,$3,$4)`;
          await client.query(assignQuery, [
            assignee.team_member_id,
            template.project_id,
            createdTask.id,
            assignee.assigned_by
          ]);
        }
      }
    }

    // Assign labels
    if (template.labels && Array.isArray(template.labels)) {
      for (const label of template.labels) {
        if (label.label_id) {
          const labelQuery = `SELECT add_or_remove_task_label($1, $2) AS labels;`;
          await client.query(labelQuery, [createdTask.id, label.label_id]);
        }
      }
    }

    // Update schedule tracking
    const updateScheduleQuery = `
      UPDATE task_recurring_schedules
      SET last_checked_at = NOW(),
          last_created_task_end_date = $1::DATE,
          occurrence_count = COALESCE(occurrence_count, 0) + 1
      WHERE id = $2;
    `;
    await client.query(updateScheduleQuery, [nextEndDate.format(TIME_FORMAT), template.schedule_id]);

    await client.query("COMMIT");
    log(`Created recurring task "${template.name}" due ${nextEndDate.format(TIME_FORMAT)}`);
    return true;
  } catch (error: any) {
    await client.query("ROLLBACK");
    
    // Handle unique constraint violation gracefully (duplicate task for same date)
    if (error?.code === "23505") {
      log(`Skipped duplicate: "${template.name}" for ${nextEndDate.format(TIME_FORMAT)}`);
      return false;
    }
    throw error;
  } finally {
    client.release();
  }
}

// Change status of the original task based on recurring schedule
async function changeTaskStatus(
  template: ITaskTemplate & IRecurringSchedule & { target_status_id: string | null },
  nextEndDate: moment.Moment
): Promise<boolean> {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    // Get the original task ID from the template
    const getTaskQuery = `SELECT task_id FROM task_recurring_templates WHERE schedule_id = $1 LIMIT 1;`;
    const taskResult = await client.query(getTaskQuery, [template.schedule_id]);
    const taskId = taskResult.rows[0]?.task_id;

    if (!taskId) {
      await client.query("ROLLBACK");
      log(`No task found for schedule ${template.schedule_id}`);
      return false;
    }

    // Determine target status: use target_status_id if provided, otherwise get default Todo status
    let targetStatusId = template.target_status_id;
    
    if (!targetStatusId) {
      // Get the default Todo status for this project
      const defaultStatusQuery = `
        SELECT id FROM task_statuses 
        WHERE project_id = $1 
          AND category_id IN (SELECT id FROM sys_task_status_categories WHERE is_todo IS TRUE)
        LIMIT 1;
      `;
      const statusResult = await client.query(defaultStatusQuery, [template.project_id]);
      targetStatusId = statusResult.rows[0]?.id;

      if (!targetStatusId) {
        await client.query("ROLLBACK");
        log(`No Todo status found for project ${template.project_id}`);
        return false;
      }
    }

    // Get the status category information to determine if it's a "done" status
    const statusCategoryQuery = `
      SELECT sc.is_done, sc.is_todo, sc.is_doing
      FROM task_statuses ts
      JOIN sys_task_status_categories sc ON ts.category_id = sc.id
      WHERE ts.id = $1;
    `;
    const categoryResult = await client.query(statusCategoryQuery, [targetStatusId]);
    const statusCategory = categoryResult.rows[0];

    // Get current progress value
    const progressQuery = `
      SELECT progress_value, manual_progress
      FROM tasks
      WHERE id = $1;
    `;
    const progressResult = await client.query(progressQuery, [taskId]);
    const currentProgress = progressResult.rows[0]?.progress_value;

    // Handle progress updates based on status category
    if (statusCategory?.is_done) {
      // Moving to "done" status - set progress to 100% if not already
      if (currentProgress !== 100) {
        await client.query(`
          UPDATE tasks
          SET progress_value = 100, manual_progress = TRUE
          WHERE id = $1;
        `, [taskId]);
        log(`Task ${taskId} moved to done status - progress set to 100%`);
      }
    } else {
      // Moving from "done" to "todo" or "doing" - reset manual_progress to FALSE
      // so progress can be recalculated based on subtasks
      await client.query(`
        UPDATE tasks
        SET manual_progress = FALSE
        WHERE id = $1;
      `, [taskId]);
      log(`Task ${taskId} moved from done status - manual_progress reset to FALSE`);
    }

    // Update the task status
    const updateTaskQuery = `
      UPDATE tasks 
      SET status_id = $1,
          updated_at = NOW()
      WHERE id = $2;
    `;
    await client.query(updateTaskQuery, [targetStatusId, taskId]);

    // Update schedule tracking
    const updateScheduleQuery = `
      UPDATE task_recurring_schedules
      SET last_checked_at = NOW(),
          last_created_task_end_date = $1::DATE,
          occurrence_count = COALESCE(occurrence_count, 0) + 1
      WHERE id = $2;
    `;
    await client.query(updateScheduleQuery, [nextEndDate.format(TIME_FORMAT), template.schedule_id]);

    await client.query("COMMIT");
    log(`Changed status for recurring task "${template.name}" on ${nextEndDate.format(TIME_FORMAT)}`);
    return true;
  } catch (error: any) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function onRecurringTaskJobTick() {
  // Hold a single dedicated connection for the lifetime of the lock. The advisory
  // lock is session-scoped, so acquire + release must run on this exact client.
  const lockClient = await db.pool.connect();
  let lockAcquired = false;

  try {
    // Safeguard 1: Advisory lock — prevent concurrent execution
    lockAcquired = await acquireAdvisoryLock(lockClient);
    if (!lockAcquired) {
      log("(cron) Skipped — another instance is already running.");
      return;
    }

    log("(cron) Recurring tasks job started.");

    // Safeguard 2: Only fetch active schedules for non-archived, non-deleted projects
    // Join with timezones to get the timezone name for timezone-aware date calculations
    const templatesQuery = `
      SELECT
        t.*,
        s.schedule_type,
        s.days_of_week,
        s.day_of_month,
        s.date_of_month,
        s.week_of_month,
        s.interval_days,
        s.interval_weeks,
        s.interval_months,
        s.start_date AS schedule_start_date,
        s.end_date AS schedule_end_date,
        s.max_occurrences,
        s.occurrence_count,
        s.is_active,
        s.last_checked_at,
        s.last_created_task_end_date,
        s.created_at AS schedule_created_at,
        s.recurring_mode,
        s.target_status_id,
        COALESCE(tz.name, 'UTC') AS timezone_name,
        (SELECT MAX(end_date) FROM tasks WHERE schedule_id = s.id) AS last_task_end_date
      FROM task_recurring_templates t
      JOIN task_recurring_schedules s ON t.schedule_id = s.id
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN timezones tz ON s.timezone_id = tz.id
      WHERE s.is_active IS NOT FALSE
        AND (s.end_date IS NULL OR s.end_date >= CURRENT_DATE)
        AND (s.max_occurrences IS NULL OR COALESCE(s.occurrence_count, 0) < s.max_occurrences)
      ORDER BY s.created_at ASC;
    `;

    const templatesResult = await db.query(templatesQuery);
    const templates = templatesResult.rows as (ITaskTemplate & IRecurringSchedule & {
      schedule_start_date: Date | null;
      schedule_end_date: Date | null;
      max_occurrences: number | null;
      occurrence_count: number | null;
      is_active: boolean;
      schedule_created_at: Date;
      timezone_name: string;
      recurring_mode: 'create_task' | 'change_status';
      target_status_id: string | null;
    })[];

    let createdTaskCount = 0;

    for (const template of templates) {
      // Safeguard 3: Per-tick global cap
      if (createdTaskCount >= MAX_TASKS_PER_TICK) {
        log(`(cron) Reached per-tick cap of ${MAX_TASKS_PER_TICK} tasks. Remaining will be processed next tick.`);
        break;
      }

      try {
        // Use the schedule's timezone for all date comparisons
        const tz = template.timezone_name || "UTC";
        const now = moment.tz(tz);

        // Determine the reference date: latest existing task's end_date, or schedule creation date
        const lastTaskEndDate = template.last_task_end_date
          ? moment(template.last_task_end_date).tz(tz)
          : moment(template.schedule_created_at).tz(tz);

        // Calculate the next occurrence date
        const nextEndDate = calculateNextEndDate(template, lastTaskEndDate);

        // Safeguard 4: End condition — don't create past the schedule's end_date
        if (template.schedule_end_date && nextEndDate.isAfter(moment(template.schedule_end_date).tz(tz))) {
          log(`Skipped "${template.name}" (schedule_id: ${template.schedule_id}): past end_date ${template.schedule_end_date}`);
          continue;
        }

        // Check max_occurrences (already filtered in WHERE, but double-check for safety)
        if (template.max_occurrences && (template.occurrence_count || 0) >= template.max_occurrences) {
          log(`Skipped "${template.name}" (schedule_id: ${template.schedule_id}): reached max_occurrences ${template.max_occurrences}`);
          continue;
        }

        // "Create next 1 only" model:
        // Only create if there are no future tasks already created for this schedule
        // Use day-level comparison since last_task_end_date is a DATE field (no time component)
        const hasFutureTask = template.last_task_end_date
          ? moment(template.last_task_end_date).tz(tz).isSameOrAfter(now, 'day')
          : false;

        if (hasFutureTask) {
          continue;
        }

        // Handle based on recurring mode
        const recurringMode = template.recurring_mode || 'create_task';
        let created = false;

        if (recurringMode === 'change_status') {
          created = await changeTaskStatus(template, nextEndDate);
        } else {
          created = await createSingleRecurringTask(template, nextEndDate);
        }

        if (created) {
          createdTaskCount++;
        }
      } catch (templateError) {
        log_error(`Error processing template "${template.name}" (schedule: ${template.schedule_id})`);
        log_error(templateError);
      }
    }

    log(`(cron) Recurring tasks job ended. Created ${createdTaskCount} task(s).`);
  } catch (error) {
    log_error(error);
    log("(cron) Recurring task job ended with errors.");
  } finally {
    if (lockAcquired) {
      try {
        await releaseAdvisoryLock(lockClient);
      } catch (releaseError) {
        log_error(releaseError);
      }
    }
    lockClient.release();
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