import db from "../config/db";
import { log_error } from "../shared/utils";

export interface NotificationData {
  userId: string;
  projectId: string;
  taskId: string;
  taskName: string;
  templateName: string;
  scheduleId: string;
  createdBy?: string;
}

export class RecurringTasksNotifications {
  /**
   * Send notification to user about a new recurring task
   */
  static async notifyTaskCreated(data: NotificationData): Promise<void> {
    try {
      // Create notification in the database
      const notificationQuery = `
        INSERT INTO notifications (
          user_id,
          message,
          data,
          created_at
        ) VALUES ($1, $2, $3, NOW())
      `;

      const message = `New recurring task "${data.taskName}" has been created from template "${data.templateName}"`;
      const notificationData = {
        type: 'recurring_task_created',
        task_id: data.taskId,
        project_id: data.projectId,
        schedule_id: data.scheduleId,
        task_name: data.taskName,
        template_name: data.templateName
      };

      await db.query(notificationQuery, [
        data.userId,
        message,
        JSON.stringify(notificationData)
      ]);

    } catch (error) {
      log_error("Failed to create notification:", error);
    }
  }

  /**
   * Send notifications to all assignees of created tasks
   */
  static async notifyAssignees(
    taskIds: string[],
    templateName: string,
    projectId: string
  ): Promise<void> {
    if (taskIds.length === 0) return;

    try {
      // Get all assignees for the created tasks
      const assigneesQuery = `
        SELECT DISTINCT ta.team_member_id, t.id as task_id, t.name as task_name
        FROM tasks_assignees ta
        JOIN tasks t ON ta.task_id = t.id
        WHERE t.id = ANY($1)
      `;

      const result = await db.query(assigneesQuery, [taskIds]);
      
      // Send notification to each assignee
      for (const assignee of result.rows) {
        await this.notifyTaskCreated({
          userId: assignee.team_member_id,
          projectId,
          taskId: assignee.task_id,
          taskName: assignee.task_name,
          templateName,
          scheduleId: '' // Not needed for assignee notifications
        });
      }

    } catch (error) {
      log_error("Failed to notify assignees:", error);
    }
  }

  /**
   * Send email notifications (if email system is configured)
   */
  static async sendEmailNotifications(
    userIds: string[],
    subject: string,
    message: string
  ): Promise<void> {
    try {
      // Get user email addresses
      const usersQuery = `
        SELECT id, email, name, email_notifications
        FROM users
        WHERE id = ANY($1) AND email_notifications = true AND email IS NOT NULL
      `;

      const result = await db.query(usersQuery, [userIds]);
      
      // TODO: Integrate with your email service (SendGrid, AWS SES, etc.)
      // For now, just log the email notifications that would be sent
      for (const user of result.rows) {
        console.log(`Email notification would be sent to ${user.email}: ${subject}`);
        
        // Example: await emailService.send({
        //   to: user.email,
        //   subject,
        //   html: message
        // });
      }

    } catch (error) {
      log_error("Failed to send email notifications:", error);
    }
  }

  /**
   * Send push notifications (if push notification system is configured)
   */
  static async sendPushNotifications(
    userIds: string[],
    title: string,
    body: string,
    data?: any
  ): Promise<void> {
    try {
      // Get user push tokens
      const tokensQuery = `
        SELECT user_id, push_token
        FROM user_push_tokens
        WHERE user_id = ANY($1) AND push_token IS NOT NULL
      `;

      const result = await db.query(tokensQuery, [userIds]);
      
      // TODO: Integrate with your push notification service (FCM, APNs, etc.)
      // For now, just log the push notifications that would be sent
      for (const token of result.rows) {
        console.log(`Push notification would be sent to ${token.push_token}: ${title}`);
        
        // Example: await pushService.send({
        //   token: token.push_token,
        //   title,
        //   body,
        //   data
        // });
      }

    } catch (error) {
      log_error("Failed to send push notifications:", error);
    }
  }

  /**
   * Get notification preferences for users
   */
  static async getNotificationPreferences(userIds: string[]): Promise<any[]> {
    try {
      const query = `
        SELECT 
          id,
          email_notifications,
          push_notifications,
          in_app_notifications
        FROM users
        WHERE id = ANY($1)
      `;

      const result = await db.query(query, [userIds]);
      return result.rows;

    } catch (error) {
      log_error("Failed to get notification preferences:", error);
      return [];
    }
  }

  /**
   * Comprehensive notification for recurring task creation
   */
  static async notifyRecurringTasksCreated(
    templateName: string,
    projectId: string,
    createdTasks: Array<{ id: string; name: string }>,
    assignees: string[] = [],
    reporterId?: string
  ): Promise<void> {
    try {
      const taskIds = createdTasks.map(t => t.id);
      const allUserIds = [...new Set([...assignees, reporterId].filter(Boolean))];

      if (allUserIds.length === 0) return;

      // Get notification preferences
      const preferences = await this.getNotificationPreferences(allUserIds);
      
      // Send in-app notifications
      const inAppUsers = preferences.filter(p => p.in_app_notifications !== false);
      for (const user of inAppUsers) {
        for (const task of createdTasks) {
          await this.notifyTaskCreated({
            userId: user.id,
            projectId,
            taskId: task.id,
            taskName: task.name,
            templateName,
            scheduleId: '',
            createdBy: 'system'
          });
        }
      }

      // Send email notifications
      const emailUsers = preferences
        .filter(p => p.email_notifications === true)
        .map(p => p.id);
      
      if (emailUsers.length > 0) {
        const subject = `New Recurring Tasks Created: ${templateName}`;
        const message = `
          <h3>Recurring Tasks Created</h3>
          <p>${createdTasks.length} new tasks have been created from template "${templateName}":</p>
          <ul>
            ${createdTasks.map(t => `<li>${t.name}</li>`).join('')}
          </ul>
        `;
        
        await this.sendEmailNotifications(emailUsers, subject, message);
      }

      // Send push notifications
      const pushUsers = preferences
        .filter(p => p.push_notifications !== false)
        .map(p => p.id);
      
      if (pushUsers.length > 0) {
        await this.sendPushNotifications(
          pushUsers,
          'New Recurring Tasks',
          `${createdTasks.length} tasks created from ${templateName}`,
          {
            type: 'recurring_tasks_created',
            project_id: projectId,
            task_count: createdTasks.length
          }
        );
      }

    } catch (error) {
      log_error("Failed to send comprehensive notifications:", error);
    }
  }
}