import db from "../config/db";
import { log_error } from "../shared/utils";
import { SlackService } from "./slack.service";
import { TeamsNotificationService } from "./teams-notification.service";

interface TaskNotificationData {
  task_id: string;
  task_name: string;
  project_id: string;
  project_name: string;
  status_name?: string;
  status_color?: string;
  assignee_names?: string[];
  task_url: string;
  old_status_name?: string;
  new_status_name?: string;
}

/**
 * External Notifications Service
 * Handles sending notifications to external services (Slack, Teams) for task events
 */
export class ExternalNotificationsService {

  /**
   * Get task data for notifications
   */
  private static async getTaskNotificationData(taskId: string): Promise<TaskNotificationData | null> {
    try {
      const query = `
        SELECT 
          t.id as task_id,
          t.name as task_name,
          t.project_id,
          p.name as project_name,
          ts.name as status_name,
          stsc.color_code as status_color,
          COALESCE(
            ARRAY_AGG(u.name) FILTER (WHERE u.name IS NOT NULL),
            ARRAY[]::text[]
          ) as assignee_names
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        LEFT JOIN task_statuses ts ON t.status_id = ts.id
        LEFT JOIN sys_task_status_categories stsc ON ts.category_id = stsc.id
        LEFT JOIN task_assignees ta ON t.id = ta.task_id
        LEFT JOIN team_members tm ON ta.team_member_id = tm.id
        LEFT JOIN users u ON tm.user_id = u.id
        WHERE t.id = $1
        GROUP BY t.id, t.name, t.project_id, p.name, ts.name, stsc.color_code;
      `;
      
      const result = await db.query(query, [taskId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const taskUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/worklenz/projects/${row.project_id}?task=${row.task_id}`;

      return {
        task_id: row.task_id,
        task_name: row.task_name,
        project_id: row.project_id,
        project_name: row.project_name,
        status_name: row.status_name,
        status_color: row.status_color,
        assignee_names: row.assignee_names || [],
        task_url: taskUrl
      };
    } catch (error) {
      log_error("Error fetching task notification data:", error);
      return null;
    }
  }

  /**
   * Format Slack message with blocks
   */
  private static formatSlackMessage(
    notificationType: string,
    taskData: TaskNotificationData,
    userName: string
  ): any {
    const emoji = notificationType === "task_create" ? "🆕" : 
                  notificationType === "task_assign" ? "👤" : "🔄";
    
    const title = notificationType === "task_create" ? "Task Created" :
                  notificationType === "task_assign" ? "Task Assigned" : "Task Status Changed";

    const blocks: any[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${emoji} ${title}`,
          emoji: true
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Task:*\n<${taskData.task_url}|${taskData.task_name}>`
          },
          {
            type: "mrkdwn",
            text: `*Project:*\n${taskData.project_name}`
          }
        ]
      }
    ];

    // Add specific fields based on notification type
    if (notificationType === "task_assign" && taskData.assignee_names && taskData.assignee_names.length > 0) {
      blocks.push({
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Assignees:*\n${taskData.assignee_names.join(", ")}`
          },
          {
            type: "mrkdwn",
            text: `*Assigned By:*\n${userName}`
          }
        ]
      });
    } else if (notificationType === "task_status_change" && taskData.old_status_name && taskData.new_status_name) {
      blocks.push({
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Status Change:*\n${taskData.old_status_name} → ${taskData.new_status_name}`
          },
          {
            type: "mrkdwn",
            text: `*Changed By:*\n${userName}`
          }
        ]
      });
    } else if (notificationType === "task_create") {
      const fields: any[] = [
        {
          type: "mrkdwn",
          text: `*Created By:*\n${userName}`
        }
      ];
      
      if (taskData.status_name) {
        fields.push({
          type: "mrkdwn",
          text: `*Status:*\n${taskData.status_name}`
        });
      }
      
      blocks.push({
        type: "section",
        fields: fields
      });
    }

    // Add context with timestamp
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `<!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|${new Date().toISOString()}>`
        }
      ]
    });

    return {
      blocks: blocks,
      text: `${title}: ${taskData.task_name}` // Fallback text for notifications
    };
  }

  /**
   * Format Teams message with adaptive card
   */
  private static formatTeamsMessage(
    notificationType: string,
    taskData: TaskNotificationData,
    userName: string
  ): any {
    const emoji = notificationType === "task_create" ? "🆕" : 
                  notificationType === "task_assign" ? "👤" : "🔄";
    
    const title = notificationType === "task_create" ? "Task Created" :
                  notificationType === "task_assign" ? "Task Assigned" : "Task Status Changed";

    const facts: any[] = [
      {
        title: "Task:",
        value: taskData.task_name
      },
      {
        title: "Project:",
        value: taskData.project_name
      }
    ];

    // Add specific facts based on notification type
    if (notificationType === "task_assign" && taskData.assignee_names && taskData.assignee_names.length > 0) {
      facts.push({
        title: "Assignees:",
        value: taskData.assignee_names.join(", ")
      });
      facts.push({
        title: "Assigned By:",
        value: userName
      });
    } else if (notificationType === "task_status_change" && taskData.old_status_name && taskData.new_status_name) {
      facts.push({
        title: "Status Change:",
        value: `${taskData.old_status_name} → ${taskData.new_status_name}`
      });
      facts.push({
        title: "Changed By:",
        value: userName
      });
    } else if (notificationType === "task_create") {
      facts.push({
        title: "Created By:",
        value: userName
      });
      if (taskData.status_name) {
        facts.push({
          title: "Status:",
          value: taskData.status_name
        });
      }
    }

    return {
      type: "message",
      attachments: [
        {
          contentType: "application/vnd.microsoft.card.adaptive",
          content: {
            $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
            type: "AdaptiveCard",
            version: "1.4",
            body: [
              {
                type: "TextBlock",
                text: `${emoji} ${title}`,
                weight: "Bolder",
                size: "Medium",
                color: "Accent"
              },
              {
                type: "FactSet",
                facts: facts,
                spacing: "Medium"
              },
              {
                type: "ActionSet",
                actions: [
                  {
                    type: "Action.OpenUrl",
                    title: "View Task",
                    url: taskData.task_url
                  }
                ]
              }
            ]
          }
        }
      ]
    };
  }

  /**
   * Get status name by ID
   */
  private static async getStatusName(statusId: string): Promise<string | null> {
    try {
      const query = `SELECT name FROM task_statuses WHERE id = $1`;
      const result = await db.query(query, [statusId]);
      return result.rows[0]?.name || null;
    } catch (error) {
      log_error("Error fetching status name:", error);
      return null;
    }
  }

  /**
   * Send external notifications (Slack and Teams)
   */
  public static async sendExternalNotifications(
    projectId: string,
    taskId: string,
    notificationType: "task_create" | "task_assign" | "task_status_change",
    userName: string,
    additionalData?: { oldStatusId?: string; newStatusId?: string }
  ): Promise<void> {
    try {
      // Get task data
      const taskData = await this.getTaskNotificationData(taskId);
      
      if (!taskData) {
        log_error("Task data not found for notification");
        return;
      }

      // Add status change data if provided
      if (additionalData?.oldStatusId && additionalData?.newStatusId) {
        taskData.old_status_name = await this.getStatusName(additionalData.oldStatusId) || undefined;
        taskData.new_status_name = await this.getStatusName(additionalData.newStatusId) || undefined;
      }

      // Get Slack channel configs for this project
      const slackConfigs = await SlackService.getChannelConfigsByProject(projectId);
      
      // Send to Slack channels
      for (const config of slackConfigs) {
        try {
          // Check if this notification type is enabled for this channel
          if (!config.notification_types || !config.notification_types.includes(notificationType)) {
            continue;
          }

          const slackMessage = this.formatSlackMessage(notificationType, taskData, userName);
          
          await SlackService.sendNotification(
            config.id,
            notificationType,
            "task",
            taskId,
            slackMessage
          );
        } catch (error) {
          log_error(`Error sending Slack notification to config ${config.id}:`, error);
          // Continue with other channels even if one fails
        }
      }

      // Send to Teams webhook if configured
      const teamsWebhookUrl = process.env.TEAMS_WEBHOOK_URL;
      if (teamsWebhookUrl) {
        try {
          const teamsMessage = this.formatTeamsMessage(notificationType, taskData, userName);
          await TeamsNotificationService.sendTeamsNotification(teamsWebhookUrl, teamsMessage);
        } catch (error) {
          log_error("Error sending Teams notification:", error);
        }
      }

    } catch (error) {
      log_error("Error in sendExternalNotifications:", error);
      // Don't throw - we don't want notification errors to break task operations
    }
  }
}

