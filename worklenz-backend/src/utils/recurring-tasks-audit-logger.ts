import db from "../config/db";
import { log_error } from "../shared/utils";

export enum RecurringTaskOperationType {
  CRON_JOB_RUN = "cron_job_run",
  CRON_JOB_ERROR = "cron_job_error",
  TEMPLATE_CREATED = "template_created",
  TEMPLATE_UPDATED = "template_updated",
  TEMPLATE_DELETED = "template_deleted",
  SCHEDULE_CREATED = "schedule_created",
  SCHEDULE_UPDATED = "schedule_updated",
  SCHEDULE_DELETED = "schedule_deleted",
  TASKS_CREATED = "tasks_created",
  TASKS_CREATION_FAILED = "tasks_creation_failed",
  MANUAL_TRIGGER = "manual_trigger",
  BULK_OPERATION = "bulk_operation"
}

export interface AuditLogEntry {
  operationType: RecurringTaskOperationType;
  templateId?: string;
  scheduleId?: string;
  taskId?: string;
  templateName?: string;
  success?: boolean;
  errorMessage?: string;
  details?: any;
  createdTasksCount?: number;
  failedTasksCount?: number;
  executionTimeMs?: number;
  createdBy?: string;
}

export class RecurringTasksAuditLogger {
  private static startTime: number;

  /**
   * Start timing an operation
   */
  static startTimer(): void {
    this.startTime = Date.now();
  }

  /**
   * Get elapsed time since timer started
   */
  static getElapsedTime(): number {
    return this.startTime ? Date.now() - this.startTime : 0;
  }

  /**
   * Log a recurring task operation
   */
  static async log(entry: AuditLogEntry): Promise<void> {
    try {
      const query = `SELECT log_recurring_task_operation($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);`;
      
      await db.query(query, [
        entry.operationType,
        entry.templateId || null,
        entry.scheduleId || null,
        entry.taskId || null,
        entry.templateName || null,
        entry.success !== false, // Default to true
        entry.errorMessage || null,
        entry.details ? JSON.stringify(entry.details) : null,
        entry.createdTasksCount || 0,
        entry.failedTasksCount || 0,
        entry.executionTimeMs || this.getElapsedTime(),
        entry.createdBy || null
      ]);
    } catch (error) {
      // Don't let audit logging failures break the main flow
      log_error("Failed to log recurring task audit entry:", error);
    }
  }

  /**
   * Log cron job execution
   */
  static async logCronJobRun(
    totalTemplates: number,
    createdTasksCount: number,
    errors: any[] = []
  ): Promise<void> {
    await this.log({
      operationType: RecurringTaskOperationType.CRON_JOB_RUN,
      success: errors.length === 0,
      errorMessage: errors.length > 0 ? `${errors.length} errors occurred` : undefined,
      details: {
        totalTemplates,
        errors: errors.map(e => e.message || e.toString())
      },
      createdTasksCount,
      executionTimeMs: this.getElapsedTime()
    });
  }

  /**
   * Log template processing
   */
  static async logTemplateProcessing(
    templateId: string,
    templateName: string,
    scheduleId: string,
    createdCount: number,
    failedCount: number,
    details?: any
  ): Promise<void> {
    await this.log({
      operationType: RecurringTaskOperationType.TASKS_CREATED,
      templateId,
      scheduleId,
      templateName,
      success: failedCount === 0,
      createdTasksCount: createdCount,
      failedTasksCount: failedCount,
      details
    });
  }

  /**
   * Log schedule changes
   */
  static async logScheduleChange(
    operationType: RecurringTaskOperationType,
    scheduleId: string,
    templateId?: string,
    userId?: string,
    details?: any
  ): Promise<void> {
    await this.log({
      operationType,
      scheduleId,
      templateId,
      createdBy: userId,
      details
    });
  }

  /**
   * Get audit log summary
   */
  static async getAuditSummary(days: number = 7): Promise<any> {
    try {
      const query = `
        SELECT 
          operation_type,
          COUNT(*) as count,
          SUM(CASE WHEN success THEN 1 ELSE 0 END) as success_count,
          SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failure_count,
          SUM(created_tasks_count) as total_tasks_created,
          SUM(failed_tasks_count) as total_tasks_failed,
          AVG(execution_time_ms) as avg_execution_time_ms
        FROM recurring_tasks_audit_log
        WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '${days} days'
        GROUP BY operation_type
        ORDER BY count DESC;
      `;
      
      const result = await db.query(query);
      return result.rows;
    } catch (error) {
      log_error("Failed to get audit summary:", error);
      return [];
    }
  }

  /**
   * Get recent errors
   */
  static async getRecentErrors(limit: number = 10): Promise<any[]> {
    try {
      const query = `
        SELECT *
        FROM v_recent_recurring_tasks_audit
        WHERE NOT success
        ORDER BY created_at DESC
        LIMIT $1;
      `;
      
      const result = await db.query(query, [limit]);
      return result.rows;
    } catch (error) {
      log_error("Failed to get recent errors:", error);
      return [];
    }
  }
}