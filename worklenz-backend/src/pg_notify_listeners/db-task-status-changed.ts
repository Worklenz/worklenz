import {Client, Notification} from "pg";
import dbConfig from "../config/db-config";
import db from "../config/db";
import {ITaskMovedToDoneRecord} from "../interfaces/task-moved-to-done";
import {sendTaskDone} from "../shared/email-notifications";
import {getBaseUrl} from "../cron_jobs/helpers";
import {NotificationsService} from "../services/notifications/notifications.service";
import {NotificationTypes} from "../services/notifications/notification-types";
import {log_error, sanitizePlainText} from "../shared/utils";

interface ITaskSubscriberNotifyRow {
  user_id: string;
  socket_id: string | null;
  team_id: string;
  task_name: string;
  user_name: string;
  task_id: string;
  email: string;
  project_id: string;
  team_name: string;
  members: string | null;
  project_name: string;
}

/**
 * Notify WHEN_DONE task subscribers with both in-app notification and email.
 * Exported for unit testing.
 */
export async function notifyTaskDoneSubscribers(taskId: string): Promise<void> {
  try {
    const q = `
      WITH subscribers AS (
        SELECT t.name AS task_name,
               u.id AS user_id,
               u.name AS user_name,
               u.socket_id,
               u.email,
               ts.task_id,
               tm.team_id,
               (SELECT project_id FROM tasks WHERE id = ts.task_id) AS project_id,
               (SELECT name FROM teams WHERE id = tm.team_id) AS team_name,
               (SELECT STRING_AGG(DISTINCT
                                  (SELECT name
                                   FROM team_member_info_view
                                   WHERE team_member_id = tasks_assignees.team_member_id),
                                  ', ')
                FROM tasks_assignees
                WHERE task_id = ts.task_id) AS members
        FROM task_subscribers ts
               LEFT JOIN users u ON u.id = ts.user_id
               LEFT JOIN tasks t ON t.id = ts.task_id
               LEFT JOIN team_members tm ON tm.id = ts.team_member_id
        WHERE ts.task_id = $1
          AND u.is_deleted IS NOT TRUE
          AND u.id IS NOT NULL
        ORDER BY ts.created_at
      )
      SELECT user_id,
             socket_id,
             team_id,
             task_name,
             user_name,
             task_id,
             email,
             project_id,
             team_name,
             members,
             (SELECT name FROM projects WHERE id = project_id) AS project_name
      FROM subscribers;
    `;

    const result = await db.query(q, [taskId]);

    for (const data of result.rows as ITaskSubscriberNotifyRow[]) {
      await sendInAppNotification(data);
      sendEmailNotification(data);
    }
  } catch (error) {
    log_error(error);
  }
}

async function sendInAppNotification(data: ITaskSubscriberNotifyRow) {
  if (!data.user_id || !data.team_id || !data.task_id || !data.project_id) return;

  const safeTaskName = sanitizePlainText(data.task_name || "");
  const message = `Task <b>${safeTaskName}</b> has been marked as Done`;

  await NotificationsService.createNotification({
    userId: data.user_id,
    teamId: data.team_id,
    socketId: data.socket_id || undefined,
    message,
    messageKey: "notifications.taskMarkedDone",
    messageParams: {task: safeTaskName},
    notificationTypeKey: NotificationTypes.TASK_MARKED_DONE,
    taskId: data.task_id,
    projectId: data.project_id,
  });
}

function sendEmailNotification(data: ITaskSubscriberNotifyRow) {
  if (!data.email) return;

  const taskUrl = `${getBaseUrl()}/worklenz/projects/${data.project_id}?tab=tasks-list&task=${data.task_id}&from=notification`;
  const settingsUrl = `${getBaseUrl()}/worklenz/settings/notifications`;

  const task = {
    name: data.task_name,
    members: data.members || "",
    url: taskUrl,
    team_name: data.team_name,
    project_name: data.project_name
  };

  const payload: ITaskMovedToDoneRecord = {
    greeting: `Hi ${data.user_name}`,
    summary: "Great news! a task just got completed!",
    settings_url: settingsUrl,
    task
  };

  void sendTaskDone([data.email], payload);
}

export default class DbTaskStatusChangeListener {
  private static connected = false;

  public static async connect() {
    try {

      const client = new Client(dbConfig);

      await client.connect();

      await client.query("UNLISTEN db_task_status_changed");
      await client.query("LISTEN db_task_status_changed");

      client.on("notification", (notification: Notification) => {
        if (notification.channel === "db_task_status_changed") {
          const taskId = notification.payload;
          if (taskId) {
            void notifyTaskDoneSubscribers(taskId);
          }
        }
      });

      client.on("error", (err: Error) => {
        this.error(err);
      });

      this.connected = true;
      console.info("DbTaskStatusChangeListener connected.");
    } catch (err: any) {
      this.error(err);
    }
  }

  public static disconnect() {
    if (!this.connected) return;
    this.connected = false;
    console.info("DbTaskStatusChangeListener disconnected.");
  }

  private static error(err: Error) {
    this.connected = false;
    console.error("DbTaskStatusChangeListener disconnected with errors.", err);
  }
}
