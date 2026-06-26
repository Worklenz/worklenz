import db from "../config/db";
import { LOG_I18N_KEYS } from "../shared/constants";

export interface LogActivityParams {
  teamId: string;
  projectId?: string;
  userId: string;
  i18nKey: string;
  i18nParams?: Record<string, any>;
  projectName?: string;
  taskId?: string;
  attributeType?: string;
  logType?: string;
  oldValue?: string;
  newValue?: string;
}

/**
 * Centralized service for handling activity logging with i18n support
 */
export class ActivityLoggingService {
  private static projectActivityFnMissingWarned = false;

  /**
   * Log a project-related activity
   */
  static async logProjectActivity({
    teamId,
    projectId,
    userId,
    i18nKey,
    i18nParams = {},
    projectName,
  }: LogActivityParams): Promise<void> {
    if (!projectId || !teamId || !userId) {
      console.warn("Missing required parameters for project activity logging");
      return;
    }

    try {
      const q = `SELECT log_project_activity_i18n($1, $2, $3, $4, $5, $6)`;
      await db.query(q, [
        teamId,
        projectId,
        userId,
        i18nKey,
        JSON.stringify(i18nParams),
        projectName,
      ]);
    } catch (error) {
      if ((error as any)?.code === "42883") {
        if (!this.projectActivityFnMissingWarned) {
          console.warn(
            "log_project_activity_i18n is missing; run migration 20250910000002-add-i18n-logging-support.sql"
          );
          this.projectActivityFnMissingWarned = true;
        }
        return;
      }
      console.error("Failed to log project activity:", error);
    }
  }

  /**
   * Log a task-related activity
   */
  static async logTaskActivity({
    taskId,
    teamId,
    projectId,
    userId,
    attributeType,
    logType,
    i18nKey,
    i18nParams = {},
    oldValue,
    newValue,
  }: LogActivityParams): Promise<void> {
    if (!taskId || !teamId || !projectId || !userId) {
      console.warn("Missing required parameters for task activity logging");
      return;
    }

    try {
      const q = `SELECT log_task_activity_i18n($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`;
      await db.query(q, [
        taskId,
        teamId,
        projectId,
        userId,
        attributeType,
        logType,
        i18nKey,
        JSON.stringify(i18nParams),
        oldValue,
        newValue,
      ]);
    } catch (error) {
      console.error("Failed to log task activity:", error);
    }
  }

  /**
   * Convenience methods for common project activities
   */
  static async logProjectCreated(
    teamId: string,
    projectId: string,
    userId: string,
    projectName: string
  ) {
    await this.logProjectActivity({
      teamId,
      projectId,
      userId,
      i18nKey: LOG_I18N_KEYS.PROJECT_CREATED,
      projectName,
    });
  }

  static async logProjectUpdated(
    teamId: string,
    projectId: string,
    userId: string,
    projectName: string
  ) {
    await this.logProjectActivity({
      teamId,
      projectId,
      userId,
      i18nKey: LOG_I18N_KEYS.PROJECT_UPDATED,
      projectName,
    });
  }

  static async logProjectDeleted(
    teamId: string,
    projectId: string,
    userId: string,
    projectName: string
  ) {
    await this.logProjectActivity({
      teamId,
      projectId,
      userId,
      i18nKey: LOG_I18N_KEYS.PROJECT_DELETED,
      projectName,
    });
  }

  static async logProjectArchived(
    teamId: string,
    projectId: string,
    userId: string,
    projectName: string
  ) {
    await this.logProjectActivity({
      teamId,
      projectId,
      userId,
      i18nKey: LOG_I18N_KEYS.PROJECT_ARCHIVED,
      projectName,
    });
  }

  static async logProjectMemberAdded(
    teamId: string,
    projectId: string,
    userId: string,
    projectName: string,
    memberName: string
  ) {
    await this.logProjectActivity({
      teamId,
      projectId,
      userId,
      i18nKey: LOG_I18N_KEYS.PROJECT_MEMBER_ADDED,
      i18nParams: { memberName },
      projectName,
    });
  }

  static async logProjectMemberRemoved(
    teamId: string,
    projectId: string,
    userId: string,
    projectName: string,
    memberName: string
  ) {
    await this.logProjectActivity({
      teamId,
      projectId,
      userId,
      i18nKey: LOG_I18N_KEYS.PROJECT_MEMBER_REMOVED,
      i18nParams: { memberName },
      projectName,
    });
  }

  /**
   * Convenience methods for common task activities
   */
  static async logTaskCreated(
    taskId: string,
    teamId: string,
    projectId: string,
    userId: string,
    taskName: string
  ) {
    await this.logTaskActivity({
      taskId,
      teamId,
      projectId,
      userId,
      attributeType: "name",
      logType: "create",
      i18nKey: LOG_I18N_KEYS.TASK_CREATED,
      i18nParams: { taskName },
    });
  }

  static async logTaskUpdated(
    taskId: string,
    teamId: string,
    projectId: string,
    userId: string,
    taskName: string,
    attributeType: string,
    oldValue?: string,
    newValue?: string
  ) {
    await this.logTaskActivity({
      taskId,
      teamId,
      projectId,
      userId,
      attributeType,
      logType: "update",
      i18nKey: LOG_I18N_KEYS.TASK_UPDATED,
      i18nParams: { taskName },
      oldValue,
      newValue,
    });
  }
}
