import { SlackService } from "./slack.service";
import db from "../../config/db";

export class SlackNotificationHandler {
  private slackService: SlackService;

  constructor() {
    this.slackService = new SlackService();
  }

  // Send notification when task is created
  async notifyTaskCreated(taskId: string): Promise<void> {
    const task = await this.getTaskDetails(taskId);
    const channels = await this.getProjectChannels(task.project_id);

    for (const channel of channels) {
      if (this.shouldNotify(channel, "task_created")) {
        const message = this.formatTaskCreatedMessage(task);
        await this.slackService.sendNotification(
          channel.slack_workspace_id,
          channel.slack_channel_id,
          message
        );
      }
    }
  }

  // Send notification when task is completed
  async notifyTaskCompleted(taskId: string): Promise<void> {
    const task = await this.getTaskDetails(taskId);
    const channels = await this.getProjectChannels(task.project_id);

    for (const channel of channels) {
      if (this.shouldNotify(channel, "task_completed")) {
        const message = this.formatTaskCompletedMessage(task);
        await this.slackService.sendNotification(
          channel.slack_workspace_id,
          channel.slack_channel_id,
          message
        );
      }
    }
  }

  // Send notification when task is assigned
  async notifyTaskAssigned(taskId: string, assigneeId: string): Promise<void> {
    const task = await this.getTaskDetails(taskId);
    const assignee = await this.getUserDetails(assigneeId);
    const channels = await this.getProjectChannels(task.project_id);

    for (const channel of channels) {
      if (this.shouldNotify(channel, "task_assigned")) {
        const message = this.formatTaskAssignedMessage(task, assignee);
        await this.slackService.sendNotification(
          channel.slack_workspace_id,
          channel.slack_channel_id,
          message
        );
      }
    }
  }

  // Get task details
  private async getTaskDetails(taskId: string): Promise<any> {
    const query = `
            SELECT t.*, p.name as project_name 
            FROM tasks t
            JOIN projects p ON t.project_id = p.id
            WHERE t.id = $1
        `;
    const result = await db.query(query, [taskId]);
    return result.rows[0];
  }

  // Get user details
  private async getUserDetails(userId: string): Promise<any> {
    const query = `SELECT * FROM users WHERE id = $1`;
    const result = await db.query(query, [userId]);
    return result.rows[0];
  }

  // Get project channels
  private async getProjectChannels(projectId: string): Promise<any[]> {
    const query = `
            SELECT * FROM slack_channels 
            WHERE project_id = $1 AND is_active = true
        `;
    const result = await db.query(query, [projectId]);
    return result.rows;
  }

  // Check if should notify
  private shouldNotify(channel: any, notificationType: string): boolean {
    return channel.notification_types?.includes(notificationType) ?? false;
  }

  // Format messages
  private formatTaskCreatedMessage(task: any): any {
    return {
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `🆕 *New Task Created*\n*${task.name}*\nProject: ${task.project_name}`,
          },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "View Task",
              },
              url: `${process.env.FRONTEND_URL}/projects/${task.project_id}/tasks/${task.id}`,
            },
          ],
        },
      ],
    };
  }

  private formatTaskCompletedMessage(task: any): any {
    return {
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `✅ *Task Completed*\n*${task.name}*\nProject: ${task.project_name}`,
          },
        },
      ],
    };
  }

  private formatTaskAssignedMessage(task: any, assignee: any): any {
    return {
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `👤 *Task Assigned*\n*${task.name}*\nAssigned to: ${assignee.name}\nProject: ${task.project_name}`,
          },
        },
      ],
    };
  }
}
