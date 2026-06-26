import db from "../config/db";
import { log_error } from "../shared/utils";
import business from "../business";
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
        LEFT JOIN tasks_assignees ta ON t.id = ta.task_id
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
      
      // Ensure URL has protocol - Slack requires absolute URLs with protocol
      let baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
        baseUrl = `https://${baseUrl}`;
      }
      const taskUrl = `${baseUrl}/worklenz/projects/${row.project_id}?task=${row.task_id}`;

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
   * Format Slack message with blocks - Redesigned layout
   */
  private static formatSlackMessage(
    notificationType: string,
    taskData: TaskNotificationData,
    userName: string
  ): any {
    const emoji = notificationType === "task_created" ? "🆕" :
                  notificationType === "task_assigned" ? "👤" :
                  notificationType === "task_completed" ? "✅" :
                  notificationType === "comment_added" ? "💬" :
                  notificationType === "priority_changed" ? "🔺" :
                  notificationType === "due_date_changed" ? "📅" :
                  notificationType === "task_updated" ? "✏️" : "🔄";

    const title = notificationType === "task_created" ? "Task Created" :
                  notificationType === "task_assigned" ? "Task Assigned" :
                  notificationType === "task_completed" ? "Task Completed" :
                  notificationType === "comment_added" ? "Comment Added" :
                  notificationType === "priority_changed" ? "Priority Changed" :
                  notificationType === "due_date_changed" ? "Due Date Changed" :
                  notificationType === "task_updated" ? "Task Updated" : "Task Status Changed";

    // Color based on notification type
    const color = notificationType === "task_created" ? "#36a64f" :
                  notificationType === "task_assigned" ? "#3AA3E3" :
                  notificationType === "task_completed" ? "#2eb886" :
                  notificationType === "comment_added" ? "#F2C744" :
                  notificationType === "priority_changed" ? "#FF6B6B" :
                  notificationType === "due_date_changed" ? "#FFA500" :
                  taskData.status_color || "#3AA3E3";

    const blocks: any[] = [];

    // Main section with task name and action button
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${emoji} *${title}*\n<${taskData.task_url}|*${taskData.task_name}*>`
      },
      accessory: {
        type: "button",
        text: {
          type: "plain_text",
          text: "View Task",
          emoji: true
        },
        url: taskData.task_url,
        action_id: "view_task"
      }
    });

    // Context section with project info
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `📁 *${taskData.project_name}*`
        }
      ]
    });

    // Information fields section
    const fields: any[] = [];

    // Add specific fields based on notification type
    if (notificationType === "task_assigned" && taskData.assignee_names && taskData.assignee_names.length > 0) {
      fields.push({
        type: "mrkdwn",
        text: `*👥 Assigned To*\n${taskData.assignee_names.join(", ")}`
      });
      fields.push({
        type: "mrkdwn",
        text: `*👤 Assigned By*\n${userName}`
      });
    } else if ((notificationType === "status_changed" || notificationType === "task_completed") && taskData.old_status_name && taskData.new_status_name) {
      fields.push({
        type: "mrkdwn",
        text: `*📊 Status Change*\n${taskData.old_status_name} → ${taskData.new_status_name}`
      });
      fields.push({
        type: "mrkdwn",
        text: `*👤 Changed By*\n${userName}`
      });
    } else if (notificationType === "task_created") {
      fields.push({
        type: "mrkdwn",
        text: `*👤 Created By*\n${userName}`
      });
      if (taskData.status_name) {
        fields.push({
          type: "mrkdwn",
          text: `*📊 Status*\n${taskData.status_name}`
        });
      }
      if (taskData.assignee_names && taskData.assignee_names.length > 0) {
        fields.push({
          type: "mrkdwn",
          text: `*👥 Assignees*\n${taskData.assignee_names.join(", ")}`
        });
      }
    } else if (notificationType === "comment_added") {
      fields.push({
        type: "mrkdwn",
        text: `*💬 Commented By*\n${userName}`
      });
      if (taskData.status_name) {
        fields.push({
          type: "mrkdwn",
          text: `*📊 Status*\n${taskData.status_name}`
        });
      }
    } else if (notificationType === "priority_changed") {
      fields.push({
        type: "mrkdwn",
        text: `*🔺 Priority Changed*\nUpdated by ${userName}`
      });
    } else if (notificationType === "due_date_changed") {
      fields.push({
        type: "mrkdwn",
        text: `*📅 Due Date Changed*\nUpdated by ${userName}`
      });
    } else if (notificationType === "task_updated") {
      fields.push({
        type: "mrkdwn",
        text: `*✏️ Updated By*\n${userName}`
      });
      if (taskData.status_name) {
        fields.push({
          type: "mrkdwn",
          text: `*📊 Current Status*\n${taskData.status_name}`
        });
      }
    } else {
      // Default fields for other notification types
      fields.push({
        type: "mrkdwn",
        text: `*👤 Updated By*\n${userName}`
      });
      if (taskData.status_name) {
        fields.push({
          type: "mrkdwn",
          text: `*📊 Status*\n${taskData.status_name}`
        });
      }
    }

    // Add fields section if there are any fields
    if (fields.length > 0) {
      blocks.push({
        type: "section",
        fields
      });
    }

    // Footer with timestamp
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `🕐 <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|${new Date().toISOString()}>`
        }
      ]
    });

    return {
      blocks,
      text: `${emoji} ${title} - ${taskData.task_name}`, // Fallback text for notifications
      attachments: [
        {
          color,
          blocks: []
        }
      ],
      unfurl_links: false,
      unfurl_media: false
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
    const emoji = notificationType === "task_created" ? "🆕" :
                  notificationType === "task_assigned" ? "👤" :
                  notificationType === "task_completed" ? "✅" :
                  notificationType === "comment_added" ? "💬" :
                  notificationType === "priority_changed" ? "🔺" :
                  notificationType === "due_date_changed" ? "📅" :
                  notificationType === "task_updated" ? "✏️" : "🔄";

    const title = notificationType === "task_created" ? "Task Created" :
                  notificationType === "task_assigned" ? "Task Assigned" :
                  notificationType === "task_completed" ? "Task Completed" :
                  notificationType === "comment_added" ? "Comment Added" :
                  notificationType === "priority_changed" ? "Priority Changed" :
                  notificationType === "due_date_changed" ? "Due Date Changed" :
                  notificationType === "task_updated" ? "Task Updated" : "Task Status Changed";

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
    if (notificationType === "task_assigned" && taskData.assignee_names && taskData.assignee_names.length > 0) {
      facts.push({
        title: "Assignees:",
        value: taskData.assignee_names.join(", ")
      });
      facts.push({
        title: "Assigned By:",
        value: userName
      });
    } else if ((notificationType === "status_changed" || notificationType === "task_completed") && taskData.old_status_name && taskData.new_status_name) {
      facts.push({
        title: "Status Change:",
        value: `${taskData.old_status_name} → ${taskData.new_status_name}`
      });
      facts.push({
        title: "Changed By:",
        value: userName
      });
    } else if (notificationType === "task_created") {
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
    } else if (notificationType === "comment_added") {
      facts.push({
        title: "Commented By:",
        value: userName
      });
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
                facts,
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
    notificationType: "task_created" | "task_assigned" | "status_changed" | "task_completed" | "task_updated" | "priority_changed" | "due_date_changed" | "comment_added",
    userName: string,
    additionalData?: { oldStatusId?: string; newStatusId?: string; oldValue?: string; newValue?: string }
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
      const slackConfigs = await business.slack.getChannelConfigsByProject(projectId);

      // Send to Slack channels
      for (const config of slackConfigs) {
        try {
          // Check if this notification type is enabled for this channel
          if (!config.notification_types || !config.notification_types.includes(notificationType)) {
            continue;
          }

          const slackMessage = this.formatSlackMessage(notificationType, taskData, userName);

          await business.slack.sendNotification(
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
