import Bull from 'bull';
import { TimezoneUtils } from '../utils/timezone-utils';
import { RetryUtils } from '../utils/retry-utils';
import { RecurringTasksAuditLogger, RecurringTaskOperationType } from '../utils/recurring-tasks-audit-logger';
import { RecurringTasksPermissions } from '../utils/recurring-tasks-permissions';
import { RecurringTasksNotifications } from '../utils/recurring-tasks-notifications';
import { calculateNextEndDate, log_error } from '../shared/utils';
import { IRecurringSchedule, ITaskTemplate } from '../interfaces/recurring-tasks';
import moment from 'moment-timezone';
import db from '../config/db';

// Configure Redis connection
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
};

// Create job queues
export const recurringTasksQueue = new Bull('recurring-tasks', {
  redis: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 50,      // Keep last 50 failed jobs
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

export const taskCreationQueue = new Bull('task-creation', {
  redis: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 200,
    removeOnFail: 100,
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
});

// Job data interfaces
interface RecurringTaskJobData {
  templateId: string;
  scheduleId: string;
  timezone: string;
}

interface TaskCreationJobData {
  template: ITaskTemplate & IRecurringSchedule;
  endDates: string[];
  timezone: string;
}

// Job processors
recurringTasksQueue.process('process-template', async (job) => {
  const { templateId, scheduleId, timezone }: RecurringTaskJobData = job.data;
  
  try {
    RecurringTasksAuditLogger.startTimer();
    
    // Fetch template data
    const templateQuery = `
      SELECT t.*, s.*, 
             (SELECT MAX(end_date) FROM tasks WHERE schedule_id = s.id) as last_task_end_date,
             u.timezone as user_timezone
      FROM task_recurring_templates t
      JOIN task_recurring_schedules s ON t.schedule_id = s.id
      LEFT JOIN tasks orig_task ON t.task_id = orig_task.id
      LEFT JOIN users u ON orig_task.reporter_id = u.id
      WHERE t.id = $1 AND s.id = $2
    `;
    
    const result = await RetryUtils.withDatabaseRetry(async () => {
      return await db.query(templateQuery, [templateId, scheduleId]);
    }, 'fetch_template_for_job');
    
    if (result.rows.length === 0) {
      throw new Error(`Template ${templateId} not found`);
    }
    
    const template = result.rows[0] as ITaskTemplate & IRecurringSchedule & { user_timezone?: string };
    
    // Check permissions
    const permissionCheck = await RecurringTasksPermissions.validateTemplatePermissions(template.task_id);
    if (!permissionCheck.hasPermission) {
      await RecurringTasksAuditLogger.log({
        operationType: RecurringTaskOperationType.TASKS_CREATION_FAILED,
        templateId: template.task_id,
        scheduleId: template.schedule_id,
        templateName: template.name,
        success: false,
        errorMessage: `Permission denied: ${permissionCheck.reason}`,
        details: { permissionCheck, processedBy: 'job_queue' }
      });
      return;
    }
    
    // Calculate dates to create
    const now = TimezoneUtils.nowInTimezone(timezone);
    const lastTaskEndDate = template.last_task_end_date 
      ? moment.tz(template.last_task_end_date, timezone)
      : moment.tz(template.created_at, timezone);
    
    const futureLimit = moment.tz(template.last_checked_at || template.created_at, timezone)
      .add(getFutureLimit(
        template.schedule_type,
        template.interval_days || template.interval_weeks || template.interval_months || 1
      ));

    let nextEndDate = TimezoneUtils.calculateNextEndDateWithTimezone(template, lastTaskEndDate, timezone);
    const endDatesToCreate: string[] = [];

    while (nextEndDate.isSameOrBefore(futureLimit)) {
      if (nextEndDate.isAfter(now)) {
        if (!template.excluded_dates || !template.excluded_dates.includes(nextEndDate.format('YYYY-MM-DD'))) {
          endDatesToCreate.push(nextEndDate.format('YYYY-MM-DD'));
        }
      }
      nextEndDate = TimezoneUtils.calculateNextEndDateWithTimezone(template, nextEndDate, timezone);
    }
    
    if (endDatesToCreate.length > 0) {
      // Add task creation job
      await taskCreationQueue.add('create-tasks', {
        template,
        endDates: endDatesToCreate,
        timezone
      }, {
        priority: 10, // Higher priority for task creation
      });
    }
    
    // Update schedule
    await RetryUtils.withDatabaseRetry(async () => {
      const updateQuery = `
        UPDATE task_recurring_schedules 
        SET last_checked_at = $1
        WHERE id = $2;
      `;
      return await db.query(updateQuery, [now.toDate(), scheduleId]);
    }, `update_schedule_for_template_${templateId}`);
    
  } catch (error) {
    log_error('Error processing recurring task template:', error);
    throw error;
  }
});

taskCreationQueue.process('create-tasks', async (job) => {
  const { template, endDates, timezone }: TaskCreationJobData = job.data;
  
  try {
    // Create tasks using the bulk function from the cron job
    const tasksData = endDates.map(endDate => ({
      name: template.name,
      priority_id: template.priority_id,
      project_id: template.project_id,
      reporter_id: template.reporter_id,
      status_id: template.status_id || null,
      end_date: endDate,
      schedule_id: template.schedule_id
    }));

    const createTasksResult = await RetryUtils.withDatabaseRetry(async () => {
      const createTasksQuery = `SELECT * FROM create_bulk_recurring_tasks($1::JSONB);`;
      return await db.query(createTasksQuery, [JSON.stringify(tasksData)]);
    }, `create_bulk_tasks_queue_${template.name}`);
    
    const createdTasks = createTasksResult.rows.filter(row => row.created);
    const failedTasks = createTasksResult.rows.filter(row => !row.created);

    // Handle assignments and labels (similar to cron job implementation)
    if (createdTasks.length > 0 && (template.assignees?.length > 0 || template.labels?.length > 0)) {
      // ... (assignment logic from cron job)
    }

    // Send notifications
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

    // Log results
    await RecurringTasksAuditLogger.logTemplateProcessing(
      template.task_id,
      template.name,
      template.schedule_id,
      createdTasks.length,
      failedTasks.length,
      {
        timezone,
        endDates,
        processedBy: 'job_queue'
      }
    );

    return {
      created: createdTasks.length,
      failed: failedTasks.length
    };
    
  } catch (error) {
    log_error('Error creating tasks in queue:', error);
    throw error;
  }
});

// Helper function (copied from cron job)
function getFutureLimit(scheduleType: string, interval?: number): moment.Duration {
  const FUTURE_LIMITS = {
    daily: moment.duration(3, "days"),
    weekly: moment.duration(1, "week"),
    monthly: moment.duration(1, "month"),
    every_x_days: (interval: number) => moment.duration(interval, "days"),
    every_x_weeks: (interval: number) => moment.duration(interval, "weeks"),
    every_x_months: (interval: number) => moment.duration(interval, "months")
  };

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
      return moment.duration(3, "days");
  }
}

// Job schedulers
export class RecurringTasksJobScheduler {
  /**
   * Schedule recurring task processing for all templates
   */
  static async scheduleRecurringTasks(): Promise<void> {
    try {
      // Get all active templates
      const templatesQuery = `
        SELECT t.id as template_id, s.id as schedule_id, 
               COALESCE(s.timezone, u.timezone, 'UTC') as timezone
        FROM task_recurring_templates t
        JOIN task_recurring_schedules s ON t.schedule_id = s.id
        LEFT JOIN tasks orig_task ON t.task_id = orig_task.id
        LEFT JOIN users u ON orig_task.reporter_id = u.id
        WHERE s.end_date IS NULL OR s.end_date >= CURRENT_DATE
      `;
      
      const result = await db.query(templatesQuery);
      
      // Schedule a job for each template
      for (const template of result.rows) {
        await recurringTasksQueue.add('process-template', {
          templateId: template.template_id,
          scheduleId: template.schedule_id,
          timezone: template.timezone
        }, {
          delay: Math.random() * 60000, // Random delay up to 1 minute to spread load
        });
      }
      
    } catch (error) {
      log_error('Error scheduling recurring tasks:', error);
    }
  }

  /**
   * Start the job queue system
   */
  static async start(): Promise<void> {
    console.log('Starting recurring tasks job queue...');
    
    // Schedule recurring task processing every hour
    await recurringTasksQueue.add('schedule-all', {}, {
      repeat: { cron: '0 * * * *' }, // Every hour
      removeOnComplete: 1,
      removeOnFail: 1,
    });
    
    // Process the schedule-all job
    recurringTasksQueue.process('schedule-all', async () => {
      await this.scheduleRecurringTasks();
    });
    
    console.log('Recurring tasks job queue started');
  }

  /**
   * Get queue statistics
   */
  static async getStats(): Promise<any> {
    const [recurringStats, creationStats] = await Promise.all([
      recurringTasksQueue.getJobCounts(),
      taskCreationQueue.getJobCounts()
    ]);
    
    return {
      recurringTasks: recurringStats,
      taskCreation: creationStats
    };
  }
}