import { CronJob } from "cron";
import { calculateNextEndDate, log_error } from "../shared/utils";
import db from "../config/db";
import { IRecurringSchedule, ITaskTemplate } from "../interfaces/recurring-tasks";
import moment from "moment-timezone";
import TasksController from "../controllers/tasks-controller";
import { TimezoneUtils } from "../utils/timezone-utils";
import { RetryUtils } from "../utils/retry-utils";
import { RecurringTasksAuditLogger, RecurringTaskOperationType } from "../utils/recurring-tasks-audit-logger";
import { RecurringTasksPermissions } from "../utils/recurring-tasks-permissions";
import { RecurringTasksNotifications } from "../utils/recurring-tasks-notifications";

// Run every hour to process tasks in different timezones
const TIME = process.env.RECURRING_JOBS_INTERVAL || "0 * * * *";
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

// Helper function to batch create tasks using bulk operations
async function createBatchTasks(template: ITaskTemplate & IRecurringSchedule, endDates: moment.Moment[]) {
  if (endDates.length === 0) return [];

  try {
    // Prepare bulk task data
    const tasksData = endDates.map(endDate => ({
      name: template.name,
      priority_id: template.priority_id,
      project_id: template.project_id,
      reporter_id: template.reporter_id,
      status_id: template.status_id || null,
      end_date: endDate.format(TIME_FORMAT),
      schedule_id: template.schedule_id
    }));

    // Create all tasks in bulk with retry logic
    const createTasksResult = await RetryUtils.withDatabaseRetry(async () => {
      const createTasksQuery = `SELECT * FROM create_bulk_recurring_tasks($1::JSONB);`;
      return await db.query(createTasksQuery, [JSON.stringify(tasksData)]);
    }, `create_bulk_recurring_tasks for template ${template.name}`);
    
    const createdTasks = createTasksResult.rows.filter(row => row.created);
    const failedTasks = createTasksResult.rows.filter(row => !row.created);

    // Log results
    if (createdTasks.length > 0) {
      console.log(`Created ${createdTasks.length} tasks for template ${template.name}`);
    }
    if (failedTasks.length > 0) {
      failedTasks.forEach(task => {
        console.log(`Failed to create task for template ${template.name}: ${task.error_message}`);
      });
    }

    // Only process assignments for successfully created tasks
    if (createdTasks.length > 0 && (template.assignees?.length > 0 || template.labels?.length > 0)) {
      // Validate assignee permissions
      let validAssignees = template.assignees || [];
      if (validAssignees.length > 0) {
        const invalidAssignees = await RecurringTasksPermissions.validateAssigneePermissions(
          validAssignees,
          template.project_id
        );
        
        if (invalidAssignees.length > 0) {
          console.log(`Warning: ${invalidAssignees.length} assignees do not have permissions for project ${template.project_id}`);
          // Filter out invalid assignees
          validAssignees = validAssignees.filter(
            a => !invalidAssignees.includes(a.team_member_id)
          );
        }
      }

      // Prepare bulk assignments
      const assignments = [];
      const labelAssignments = [];

      for (const task of createdTasks) {
        // Prepare team member assignments with validated assignees
        if (validAssignees.length > 0) {
          for (const assignee of validAssignees) {
            assignments.push({
              task_id: task.task_id,
              team_member_id: assignee.team_member_id,
              assigned_by: assignee.assigned_by
            });
          }
        }

        // Prepare label assignments
        if (template.labels?.length > 0) {
          for (const label of template.labels) {
            labelAssignments.push({
              task_id: task.task_id,
              label_id: label.label_id
            });
          }
        }
      }

      // Bulk assign team members with retry logic
      if (assignments.length > 0) {
        await RetryUtils.withDatabaseRetry(async () => {
          const assignQuery = `SELECT * FROM bulk_assign_team_members($1::JSONB);`;
          return await db.query(assignQuery, [JSON.stringify(assignments)]);
        }, `bulk_assign_team_members for template ${template.name}`);
      }

      // Bulk assign labels with retry logic
      if (labelAssignments.length > 0) {
        await RetryUtils.withDatabaseRetry(async () => {
          const labelQuery = `SELECT * FROM bulk_assign_labels($1::JSONB);`;
          return await db.query(labelQuery, [JSON.stringify(labelAssignments)]);
        }, `bulk_assign_labels for template ${template.name}`);
      }

      // Send notifications for created tasks
      if (createdTasks.length > 0) {
        const taskData = createdTasks.map(task => ({ id: task.task_id, name: task.task_name }));
        const assigneeIds = template.assignees?.map(a => a.team_member_id) || [];
        
        await RecurringTasksNotifications.notifyRecurringTasksCreated(
          template.name,
          template.project_id,
          taskData,
          assigneeIds,
          template.reporter_id
        );
      }
    }

    return createdTasks.map(task => ({ id: task.task_id, name: task.task_name }));
  } catch (error) {
    log_error("Error in bulk task creation:", error);
    // Fallback to sequential creation if bulk operation fails
    console.log("Falling back to sequential task creation");
    return createBatchTasksSequential(template, endDates);
  }
}

// Fallback function for sequential task creation
async function createBatchTasksSequential(template: ITaskTemplate & IRecurringSchedule, endDates: moment.Moment[]) {
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
    const errors: any[] = [];
    
    try {
        log("(cron) Recurring tasks job started.");
        RecurringTasksAuditLogger.startTimer();

        // Get all active timezones where it's currently the scheduled hour
        const activeTimezones = TimezoneUtils.getActiveTimezones();
        log(`Processing recurring tasks for ${activeTimezones.length} timezones`);

        // Fetch templates with retry logic
        const templatesResult = await RetryUtils.withDatabaseRetry(async () => {
            const templatesQuery = `
                SELECT t.*, s.*, 
                       (SELECT MAX(end_date) FROM tasks WHERE schedule_id = s.id) as last_task_end_date,
                       u.timezone as user_timezone
                FROM task_recurring_templates t
                JOIN task_recurring_schedules s ON t.schedule_id = s.id
                LEFT JOIN tasks orig_task ON t.task_id = orig_task.id
                LEFT JOIN users u ON orig_task.reporter_id = u.id
                WHERE s.end_date IS NULL OR s.end_date >= CURRENT_DATE;
            `;
            return await db.query(templatesQuery);
        }, "fetch_recurring_templates");
        
        const templates = templatesResult.rows as (ITaskTemplate & IRecurringSchedule & { user_timezone?: string })[];

        let createdTaskCount = 0;

        for (const template of templates) {
            // Check template permissions before processing
            const permissionCheck = await RecurringTasksPermissions.validateTemplatePermissions(template.task_id);
            if (!permissionCheck.hasPermission) {
                console.log(`Skipping template ${template.name}: ${permissionCheck.reason}`);
                
                // Log permission issue
                await RecurringTasksAuditLogger.log({
                    operationType: RecurringTaskOperationType.TASKS_CREATION_FAILED,
                    templateId: template.task_id,
                    scheduleId: template.schedule_id,
                    templateName: template.name,
                    success: false,
                    errorMessage: `Permission denied: ${permissionCheck.reason}`,
                    details: { permissionCheck }
                });
                
                continue;
            }

            // Use template timezone or user timezone or default to UTC
            const timezone = template.timezone || TimezoneUtils.getUserTimezone(template.user_timezone);
            
            // Check if this template should run in the current hour for its timezone
            if (!activeTimezones.includes(timezone) && timezone !== 'UTC') {
                continue;
            }

            const now = TimezoneUtils.nowInTimezone(timezone);
            const lastTaskEndDate = template.last_task_end_date 
                ? moment.tz(template.last_task_end_date, timezone)
                : moment.tz(template.created_at, timezone);
            
            // Calculate future limit based on schedule type
            const futureLimit = moment.tz(template.last_checked_at || template.created_at, timezone)
                .add(getFutureLimit(
                    template.schedule_type,
                    template.interval_days || template.interval_weeks || template.interval_months || 1
                ));

            let nextEndDate = TimezoneUtils.calculateNextEndDateWithTimezone(template, lastTaskEndDate, timezone);
            const endDatesToCreate: moment.Moment[] = [];

            // Find all future occurrences within the limit
            while (nextEndDate.isSameOrBefore(futureLimit)) {
                if (nextEndDate.isAfter(now)) {
                    // Check if date is not in excluded dates
                    if (!template.excluded_dates || !template.excluded_dates.includes(nextEndDate.format(TIME_FORMAT))) {
                        endDatesToCreate.push(moment(nextEndDate));
                    }
                }
                nextEndDate = TimezoneUtils.calculateNextEndDateWithTimezone(template, nextEndDate, timezone);
            }

            // Batch create tasks for all future dates
            if (endDatesToCreate.length > 0) {
                try {
                    const createdTasks = await createBatchTasks(template, endDatesToCreate);
                    createdTaskCount += createdTasks.length;

                    // Log successful template processing
                    await RecurringTasksAuditLogger.logTemplateProcessing(
                        template.task_id,
                        template.name,
                        template.schedule_id,
                        createdTasks.length,
                        endDatesToCreate.length - createdTasks.length,
                        {
                            timezone,
                            endDates: endDatesToCreate.map(d => d.format(TIME_FORMAT))
                        }
                    );

                    // Update the last_checked_at in the schedule with retry logic
                    await RetryUtils.withDatabaseRetry(async () => {
                        const updateScheduleQuery = `
                            UPDATE task_recurring_schedules 
                            SET last_checked_at = $1, 
                                last_created_task_end_date = $2 
                            WHERE id = $3;
                        `;
                        return await db.query(updateScheduleQuery, [
                            now.toDate(),
                            endDatesToCreate[endDatesToCreate.length - 1].toDate(),
                            template.schedule_id
                        ]);
                    }, `update_schedule for template ${template.name}`);
                } catch (error) {
                    errors.push({ template: template.name, error });
                    
                    // Log failed template processing
                    await RecurringTasksAuditLogger.logTemplateProcessing(
                        template.task_id,
                        template.name,
                        template.schedule_id,
                        0,
                        endDatesToCreate.length,
                        {
                            timezone,
                            error: error.message || error.toString()
                        }
                    );
                }
            } else {
                console.log(`No tasks created for template ${template.name} (${timezone}) - next occurrence is beyond the future limit or excluded`);
            }
        }
        
        log(`(cron) Recurring tasks job ended with ${createdTaskCount} new tasks created.`);
        
        // Log cron job completion
        await RecurringTasksAuditLogger.logCronJobRun(
            templates.length,
            createdTaskCount,
            errors
        );
    } catch (error) {
        log_error(error);
        log("(cron) Recurring task job ended with errors.");
        
        // Log cron job failure
        await RecurringTasksAuditLogger.log({
            operationType: RecurringTaskOperationType.CRON_JOB_ERROR,
            success: false,
            errorMessage: error.message || error.toString(),
            details: { error: error.stack || error }
        });
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