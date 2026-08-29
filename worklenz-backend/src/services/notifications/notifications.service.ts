import db from "../../config/db";
import { IO } from "../../shared/io";
import { log_error, sanitizePlainText } from "../../shared/utils";
import { SocketEvents } from "../../socket.io/events";
import { ICreateNotificationRequest, IReceiver } from "./interfaces";
import WorklenzNotification from "./notification";
import { sendInvitationEmail } from "../../shared/email-templates";
import { IPassportSession } from "../../interfaces/passport-session";
import { NotificationTypes } from "./notification-types";

export class NotificationsService {
  public static TYPE_POP = 1;
  public static TYPE_EMAIL = 2;

  private static isAllowPopup(type: number) {
    return type & this.TYPE_POP;
  }

  private static isAllowEmail(type: number) {
    return type & this.TYPE_EMAIL;
  }

  private static isAllowBoth(type: number) {
    return this.isAllowPopup(type) && this.isAllowEmail(type);
  }

  public static async createTaskUpdate(
    type: string,
    reporterId: string,
    taskId: string,
    userId: string,
    teamId: string,
  ) {
    if (!userId || !taskId) return;
    try {
      const q =
        "SELECT notify_task_assignment_update($1, $2, $3, $4, $5) AS receiver;";
      const result = await db.query(q, [
        type,
        reporterId,
        taskId,
        userId,
        teamId,
      ]);
      const [data] = result.rows;
      const receiver = data.receiver || {};

      if (receiver?.receiver_socket_id && reporterId !== userId) {
        NotificationsService.sendNotification(receiver);
      }
    } catch (error) {
      log_error(error);
    }
  }

  /**
   * Send a "phase_task_assigned" in-app notification to the next phase's assignee.
   * Message: "A task has been assigned to you in [Phase Name]: [Task Name]"
   *
   * - Creates an in-app bell notification immediately
   * - Queues a task_updates row so the email cron job sends an email within ~10 min
   * - Pushes real-time socket NOTIFICATIONS_UPDATE so the bell updates instantly
   */
  public static async sendPhaseTaskAssignedNotification(params: {
    reporterUserId: string;
    assigneeUserId: string;
    taskId: string;
    taskName: string;
    phaseName: string;
    projectId: string;
    teamId: string;
  }): Promise<void> {
    const { reporterUserId, assigneeUserId, taskId, taskName, phaseName, projectId, teamId } = params;
    if (!assigneeUserId || !taskId || reporterUserId === assigneeUserId) return;
    try {
      const safePhaseName = sanitizePlainText(phaseName);
      const safeTaskName = sanitizePlainText(taskName);
      const message = `A task has been assigned to you in <b>${safePhaseName}</b>: <b>${safeTaskName}</b>`;

      // 1. In-app bell notification
      await db.query(`SELECT create_notification($1, $2, $3, $4, $5) AS res;`,
        [assigneeUserId, teamId, taskId, projectId, message]);

      // 2. Email queue (cron picks up within 10 min via get_task_updates)
      await db.query(
        `INSERT INTO task_updates (type, reporter_id, task_id, user_id, team_id, project_id)
         VALUES ($1, $2, $3, $4, $5, $6);`,
        [NotificationTypes.PHASE_TASK_ASSIGNED, reporterUserId, taskId, assigneeUserId, teamId, projectId]
      );

      // 3. Real-time socket push
      const socketResult = await db.query(`SELECT socket_id FROM users WHERE id = $1;`, [assigneeUserId]);
      const receiverSocketId = socketResult.rows[0]?.socket_id;
      if (receiverSocketId) {
        const projectResult = await db.query(
          `SELECT p.name AS project_name, p.color_code FROM projects p WHERE p.id = $1;`, [projectId]);
        const projectRow = projectResult.rows[0];
        const teamResult = await db.query(`SELECT name FROM teams WHERE id = $1;`, [teamId]);
        const teamName = teamResult.rows[0]?.name || "";
        NotificationsService.sendNotification({
          receiver_socket_id: receiverSocketId,
          team: teamName,
          team_id: teamId,
          message,
          project: projectRow?.project_name,
          project_color: projectRow?.color_code,
          project_id: projectId,
          task_id: taskId,
        });
      }
    } catch (error) {
      log_error(error);
    }
  }

  public static sendNotification(receiver: IReceiver): void {
    const url = receiver.project_id
      ? `/worklenz/projects/${receiver.project_id}`
      : null;
    const notification = new WorklenzNotification(
      receiver.team,
      receiver.team_id,
      receiver.message,
      url,
    );

    if (receiver.project) {
      notification.setProject(receiver.project);
    }

    if (receiver.project_color) {
      notification.setColor(receiver.project_color);
    }

    if (receiver.task_id) {
      const params: Record<string, string> = { task: receiver.task_id };
      if (receiver.comment_id) {
        params.comment = receiver.comment_id;
      }
      notification.setParams(params);
      notification.setTaskId(receiver.task_id);
    }


    if (receiver.project_id) {
      notification.setProjectId(receiver.project_id);
    }

    IO.emit(
      SocketEvents.NOTIFICATIONS_UPDATE,
      receiver.receiver_socket_id,
      notification,
    );
  }

  public static async sendNotificationToUser(
    userId: string,
    actorUserId: string | null,
    team: string,
    teamId: string,
    message: string,
  ): Promise<void> {
    if (!userId || userId === actorUserId) return;

    try {
      const result = await db.query(
        "SELECT socket_id FROM users WHERE id = $1 AND ($2::uuid IS NULL OR id != $2);",
        [userId, actorUserId],
      );
      const receiverSocketId = result.rows[0]?.socket_id;

      if (receiverSocketId) {
        this.sendNotification({
          receiver_socket_id: receiverSocketId,
          message,
          team,
          team_id: teamId,
        });
      }
    } catch (error) {
      log_error(error);
    }
  }

  public static async sendInvitation(
    userId: string,
    userName: string,
    teamName: string,
    teamId: string,
    teamMemberId: string,
    invitedUserId?: string,
  ) {
    // Sanitize user and team names to prevent XSS attacks in invitation notifications
    const safeName = sanitizePlainText(userName);
    const safeTeamName = sanitizePlainText(teamName);
    const message = `<b>${safeName}</b> has invited you to work with <b>${safeTeamName}</b>.`;
    const payload = { message, team: teamName, team_id: teamId };

    // Create a notification entry in the database if the invited user exists
    if (invitedUserId) {
      try {
        const q = "SELECT create_notification($1, $2, $3, $4, $5) AS res;";
        await db.query(q, [invitedUserId, teamId, null, null, message]);
      } catch (error) {
        log_error(error);
      }
    }

    IO.emitByTeamMemberId(
      teamMemberId,
      userId || null,
      SocketEvents.INVITATIONS_UPDATE,
      payload,
    );
  }

  public static async createNotification(request: ICreateNotificationRequest) {
    try {
      const q = `
        INSERT INTO user_notifications (message, user_id, team_id, task_id, project_id, comment_id)
        VALUES ($5, $1, $2, $3, $4, $6)
        RETURNING (SELECT name FROM teams WHERE id = $2) AS team,
                  (SELECT name FROM projects WHERE id = $4) AS project,
                  (SELECT color_code FROM projects WHERE id = $4) AS project_color;
      `; const result = await db.query(q, [
        request.userId,
        request.teamId,
        request.taskId,
        request.projectId,
        request.message,
        request.commentId ?? null,

      ]);
      const [response] = result.rows;

      this.sendNotification({
        receiver_socket_id: request.socketId,
        project: response?.project,
        message: request.message,
        project_color: response?.project_color,
        project_id: request.projectId as string,
        team: response?.team,
        team_id: request.teamId,
        task_id: request.taskId ?? undefined,
        comment_id: request.commentId ?? undefined,
      });

    } catch (error) {
      log_error(error);
    }
  }

  public static sendTeamMembersInvitations(
    members: any[],
    user: IPassportSession,
    projectId?: string,
  ) {
    for (const member of members) {
      sendInvitationEmail(
        !member.is_new,
        user,
        !member.is_new ? member.name : member.team_member_id,
        member.email,
        member.team_member_user_id,
        member.name || member.email?.split("@")[0],
        projectId,
      );

      if (member.team_member_id) {
        NotificationsService.sendInvitation(
          user.id as string,
          user.name as string,
          user.team_name as string,
          user.team_id as string,
          member.team_member_id,
          member.team_member_user_id, // Pass the invited user's ID
        );
      }

      member.id = member.team_member_id;
    }
  }
}
