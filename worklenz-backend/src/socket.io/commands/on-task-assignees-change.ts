import { Server, Socket } from "socket.io";
import { NotificationsService } from "../../services/notifications/notifications.service";
import { SocketEvents } from "../events";
import { 
  getLoggedInUserIdFromSocket, 
  notifyProjectUpdates 
} from "../util";
import { logMemberAssignment } from "../../services/activity-logs/activity-logs.service";
import { getAssignees, ITaskAssignee, runAssignOrRemove } from "./on-quick-assign-or-remove";
import { ExternalNotificationsService } from "../../services/external-notifications.service";
import db from "../../config/db";
import { log_error } from "../../shared/utils";
import {verifyTaskAccessSocket, logUnauthorizedSocketAccess} from "../authorization";

interface TaskAssigneesChangeData {
  task_id: string;
  team_id: string;
  team_member_id: string[];
  project_id: string;
  reporter_id: string;
  mode: number; // 0 for assign, 1 for unassign
}

async function isTaskCreationRestricted(userId: string, projectId: string): Promise<boolean> {
  try {
    const result = await db.query(
      "SELECT is_task_creation_restricted($1, $2) AS restricted;",
      [userId, projectId]
    );
    return result.rows[0]?.restricted === true;
  } catch {
    return false;
  }
}

export async function on_task_assignees_change(
  _io: Server, 
  socket: Socket, 
  rawData?: string
): Promise<void> {
  try {
    if (!rawData) {
      throw new Error("No data provided.");
    }

    const body: TaskAssigneesChangeData = JSON.parse(rawData);
    
    const hasAccess = await verifyTaskAccessSocket(socket, body.task_id);
    if (!hasAccess) {
      logUnauthorizedSocketAccess(socket, 'TASK_ASSIGNEES_CHANGE', 'task', body.task_id);
      return;
    }

    // Check restrict_task_creation before allowing assignment changes
    const userId = getLoggedInUserIdFromSocket(socket);
    if (userId && body.project_id) {
      const restricted = await isTaskCreationRestricted(userId, body.project_id);
      if (restricted) {
        socket.emit(SocketEvents.TASK_ASSIGNEES_CHANGE.toString(), {
          error: true,
          message: "Task assignment is restricted to Admins and Team Leads only."
        });
        return;
      }
    }

    const newAssignees: string[] = body.team_member_id;
    const prevAssignees: ITaskAssignee[] = await getAssignees(body.task_id);

    const removedAssignees = prevAssignees.filter(assignee => !newAssignees.includes(assignee.team_member_id || ""));
    const addedAssignees = newAssignees.filter(assignee => !prevAssignees.map(a => a.team_member_id || "").includes(assignee));

    if (!Array.isArray(newAssignees) || newAssignees.length === 0) {
      throw new Error("Invalid or empty assignee IDs.");
    }

    // Handle removed assignees
    const removeResults = await Promise.all(
      removedAssignees.map(async (assignee) => {
        const data = {
          task_id: body.task_id,
          team_id: body.team_id,
          team_member_id: assignee.team_member_id,
          project_id: body.project_id,
          reporter_id: body.reporter_id
        };

        const assignment = await runAssignOrRemove(data, false);

        // Log activity
        logMemberAssignment({
          task_id: body.task_id,
          socket,
          new_value: assignee.team_member_id,
          old_value: assignee.team_member_id,
          assign_type: "UNASSIGN",
        });

        // Notify if userId and assignment.user_id are different
        if (userId && userId !== assignment.user_id) {
          NotificationsService.createTaskUpdate(
            "UNASSIGN",
            userId,
            body.task_id,
            assignment.user_id,
            body.team_id
          );
        }

        return assignee.team_member_id;
      })
    );

    // Handle new assignees
    const addResults = await Promise.all(
      addedAssignees.map(async (assigneeId) => {
        const data = {
          task_id: body.task_id,
          team_id: body.team_id,
          team_member_id: assigneeId,
          project_id: body.project_id,
          reporter_id: body.reporter_id
        };

        const assignment = await runAssignOrRemove(data, true);

        // Log activity
        logMemberAssignment({
          task_id: body.task_id,
          socket,
          new_value: assigneeId,
          old_value: null,
          assign_type: "ASSIGN",
        });

        // Notify if userId and assignment.user_id are different
        if (userId && userId !== assignment.user_id) {
          NotificationsService.createTaskUpdate(
            "ASSIGN",
            userId,
            body.task_id,
            assignment.user_id,
            body.team_id
          );
        }

        return assigneeId;
      })
    );

    // Notify project updates once after all changes
    notifyProjectUpdates(socket, body.task_id);

    // Send external notifications (Slack, Teams) if there were assignments
    if (addedAssignees.length > 0) {
      try {
        const userQuery = `SELECT name FROM users WHERE id = $1`;
        const userResult = await db.query(userQuery, [userId]);
        const userName = userResult.rows[0]?.name || "Unknown User";
        
        await ExternalNotificationsService.sendExternalNotifications(
          body.project_id,
          body.task_id,
          "task_assigned",
          userName
        );
      } catch (notifError) {
        log_error("Error sending external notifications:", notifError);
        // Don't throw - continue even if notifications fail
      }
    }

    // Emit updated assignee list
    socket.emit(SocketEvents.TASK_ASSIGNEES_CHANGE.toString(), { assigneeIds: newAssignees });
  } catch (error) {
    log_error(error);
  }
}
