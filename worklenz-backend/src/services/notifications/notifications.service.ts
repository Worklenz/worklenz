import db from "../../config/db";
import {IO} from "../../shared/io";
import {log_error} from "../../shared/utils";
import {SocketEvents} from "../../socket.io/events";
import {ICreateNotificationRequest, IReceiver} from "./interfaces";
import WorklenzNotification from "./notification";
import {sendInvitationEmail} from "../../shared/email-templates";
import {IPassportSession} from "../../interfaces/passport-session";

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

  public static async createTaskUpdate(type: string, reporterId: string, taskId: string, userId: string, teamId: string) {
    if (!userId || !taskId) return;
    try {
      const q = "SELECT notify_task_assignment_update($1, $2, $3, $4, $5) AS receiver;";
      const result = await db.query(q, [type, reporterId, taskId, userId, teamId]);
      const [data] = result.rows;
      const receiver = data.receiver || {};

      if (receiver?.receiver_socket_id && (reporterId !== userId)) {
        NotificationsService.sendNotification(receiver);
      }
    } catch (error) {
      log_error(error);
    }
  }

  public static sendNotification(receiver: IReceiver): void {
    const url = receiver.project_id ? `/worklenz/projects/${receiver.project_id}` : null;
    const notification = new WorklenzNotification(receiver.team, receiver.team_id, receiver.message, url);

    if (receiver.project) {
      notification.setProject(receiver.project);
    }

    if (receiver.project_color) {
      notification.setColor(receiver.project_color);
    }

    if (receiver.task_id) {
      notification.setParams({task: receiver.task_id});
      notification.setTaskId(receiver.task_id);
    }

    if (receiver.project_id) {
      notification.setProjectId(receiver.project_id);
    }

    IO.emit(SocketEvents.NOTIFICATIONS_UPDATE, receiver.receiver_socket_id, notification);
  }

  public static sendInvitation(userId: string, userName: string, teamName: string, teamId: string, teamMemberId: string) {
    const message = `<b>${userName}</b> has invited you to work with <b>${teamName}</b>.`;
    const payload = {message, team: teamName, team_id: teamId};
    IO.emitByTeamMemberId(teamMemberId, userId || null, SocketEvents.INVITATIONS_UPDATE, payload);
  }

  public static async createNotification(request: ICreateNotificationRequest) {
    try {
      const q = "SELECT create_notification($1, $2, $3, $4, $5) AS res;";
      const result = await db.query(q, [request.userId, request.teamId, request.taskId, request.projectId, request.message]);
      const [data] = result.rows;
      const response = data.res;

      this.sendNotification({
        receiver_socket_id: request.socketId,
        project: response.project,
        message: request.message,
        project_color: response.project_color,
        project_id: request.projectId as string,
        team: response.team,
        team_id: request.teamId
      });
    } catch (error) {
      log_error(error);
    }
  }

  public static sendTeamMembersInvitations(members: any[], user: IPassportSession, projectId?: string) {
    for (const member of members) {
      sendInvitationEmail(
        !member.is_new,
        user,
        !member.is_new ? member.name : member.team_member_id,
        member.email,
        member.team_member_user_id,
        member.name || member.email?.split("@")[0],
        projectId
      );

      if (member.team_member_id) {
        NotificationsService.sendInvitation(
          user.id as string,
          user.name as string,
          user.team_name as string,
          user.team_id as string,
          member.team_member_id
        );
      }

      member.id = member.team_member_id;
    }
  }
}
