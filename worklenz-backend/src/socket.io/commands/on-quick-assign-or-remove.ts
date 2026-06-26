import {Server, Socket} from "socket.io";
import db from "../../config/db";
import WorklenzControllerBase from "../../controllers/worklenz-controller-base";
import {NotificationsService} from "../../services/notifications/notifications.service";
import {getColor} from "../../shared/utils";
import {SocketEvents} from "../events";

import {getLoggedInUserIdFromSocket, notifyProjectUpdates} from "../util";
import {logMemberAssignment} from "../../services/activity-logs/activity-logs.service";
import { ExternalNotificationsService } from "../../services/external-notifications.service";
import { log_error } from "../../shared/utils";

export interface ITaskAssignee {
  team_member_id?: string;
  project_member_id?: string;
  name?: string;
  avatar_url?: string;
  user_id?: string;
}

export async function getAssignees(taskId: string): Promise<ITaskAssignee[]> {
  const result1 = await db.query("SELECT get_task_assignees($1) AS assignees;", [taskId]);
  const [d] = result1.rows;
  const assignees = d.assignees || [];

  assignees.forEach((a: any) => a.color_code = getColor(a.name));

  return assignees;
}

export async function getTeamMembers(teamId: string) {
  const result = await db.query("SELECT get_team_members($1, NULL) AS members;", [teamId]);
  const [data] = result.rows;
  return data?.members || [];
}

export async function runAssignOrRemove(data: any, isAssignment = false) {
  const q = isAssignment
    ? "SELECT create_task_assignee($1, $2, $3, $4) AS data;"
    : `SELECT remove_task_assignee($1, $2, $3) AS data;`;

  const params = isAssignment
    ? [data.team_member_id, data.project_id, data.task_id, data.reporter_id]
    : [data.task_id, data.team_member_id, data.project_id];

  const result = await db.query(q, params);
  const [assignment] = result.rows;

  return assignment.data as {
    user_id: string;
    team_id: string;
    task_id?: string;
    project_member_id?: string;
    team_member_id?: string;
  } || null;
}

export async function on_quick_assign_or_remove(_io: Server, socket: Socket, data?: string) {
  try {
    const body = JSON.parse(data as string);
    const isAssign = body.mode == 0;
    const userId = getLoggedInUserIdFromSocket(socket);

    // Check restrict_task_creation before allowing assignment changes
    if (isAssign && userId) {
      // Resolve project_id from task if not provided
      let projectId = body.project_id;
      if (!projectId && body.task_id) {
        const pResult = await db.query("SELECT project_id FROM tasks WHERE id = $1", [body.task_id]);
        projectId = pResult.rows[0]?.project_id;
      }
      if (projectId) {
        const restrictResult = await db.query(
          "SELECT is_task_creation_restricted($1, $2) AS restricted;",
          [userId, projectId]
        );
        if (restrictResult.rows[0]?.restricted === true) {
          socket.emit(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), {
            error: true,
            message: "Task assignment is restricted to Admins and Team Leads only."
          });
          return;
        }
      }
    }

    const assignment = await runAssignOrRemove(body, isAssign);

    // Bump task updated_at so "Updated X ago" reflects the assignment change
    await db.query(`UPDATE tasks SET updated_at = NOW() WHERE id = $1;`, [body.task_id]);

    const assignees = await getAssignees(body.task_id);
    const members = await getTeamMembers(body.team_id);
    // for inline display
    const names = WorklenzControllerBase.createTagList(assignees);

    const type = isAssign ? "ASSIGN" : "UNASSIGN";

    logMemberAssignment({
      task_id: body.task_id,
      socket,
      new_value: body.team_member_id,
      old_value: null,
      assign_type: type
    });

    if (assignment && userId !== assignment.user_id) {
      NotificationsService.createTaskUpdate(
        type,
        userId as string,
        body.task_id,
        assignment.user_id,
        assignment.team_id
      );

    }
    notifyProjectUpdates(socket, body.task_id);

    // Send external notifications (Slack, Teams) only for assignments
    if (isAssign) {
      try {
        const userQuery = `SELECT name FROM users WHERE id = $1`;
        const userResult = await db.query(userQuery, [userId]);
        const userName = userResult.rows[0]?.name || "Unknown User";
        
        const projectQuery = `SELECT project_id FROM tasks WHERE id = $1`;
        const projectResult = await db.query(projectQuery, [body.task_id]);
        const projectId = projectResult.rows[0]?.project_id;
        
        if (projectId) {
          await ExternalNotificationsService.sendExternalNotifications(
            projectId,
            body.task_id,
            "task_assigned",
            userName
          );
        }
      } catch (notifError) {
        log_error("Error sending external notifications:", notifError);
        // Don't throw - continue even if notifications fail
      }
    }

    const res = {id: body.task_id, parent_task: body.parent_task, members, assignees, names, mode: body.mode, team_member_id: body.team_member_id};
    socket.emit(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), res);
    return;
  } catch (error) {
    log_error(error);
  }

  socket.emit(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), null);
}

export async function assignMemberIfNot(taskId: string, userId: string, teamId: string, io: Server, socket: Socket) {
  try {
    const q = `
      SELECT
        team_member_id,
        (SELECT project_id FROM tasks WHERE id = $1) as project_id,
        (SELECT parent_task_id FROM tasks WHERE id = $1) as parent_task_id
      FROM team_member_info_view WHERE user_id = $2 AND team_id = $3
    `;

    const result = await db.query(q, [taskId, userId, teamId]);
    const [data] = result.rows;

    if (!data) {
      // User is not a member of this team - this is normal for admins or viewers
      // Silently return without logging as this is expected behavior
      return;
    }

    const body = {
      team_member_id: data.team_member_id,
      project_id: data.project_id,
      task_id: taskId,
      reporter_id: userId,
      mode: 0,
      parent_task: data.parent_task_id
    };

    await on_quick_assign_or_remove(io, socket, JSON.stringify(body));

  } catch (e) {
    log_error(e);
  }
}
