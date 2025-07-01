import {Server, Socket} from "socket.io";

import db from "../../config/db";
import {NotificationsService} from "../../services/notifications/notifications.service";
import {TASK_STATUS_COLOR_ALPHA} from "../../shared/constants";
import {SocketEvents} from "../events";
import {getLoggedInUserIdFromSocket, log, log_error, notifyProjectUpdates} from "../util";
import TasksControllerV2 from "../../controllers/tasks-controller-v2";
import {getTaskDetails, logProgressChange, logStatusChange} from "../../services/activity-logs/activity-logs.service";
import { assignMemberIfNot } from "./on-quick-assign-or-remove";
import logger from "../../utils/logger";

export async function on_task_status_change(_io: Server, socket: Socket, data?: string) {
  try {
    const body = JSON.parse(data as string);
    const userId = getLoggedInUserIdFromSocket(socket);
    const taskData = await getTaskDetails(body.task_id, "status_id");

    const canContinue = await TasksControllerV2.checkForCompletedDependencies(body.task_id, body.status_id);

    if (!canContinue) {
      const {color_code, color_code_dark} = await TasksControllerV2.getTaskStatusColor(taskData.status_id);

      return socket.emit(SocketEvents.TASK_STATUS_CHANGE.toString(), {
        id: body.task_id,
        parent_task: body.parent_task,
        status_id: taskData.status_id,
        color_code: color_code + TASK_STATUS_COLOR_ALPHA,
        color_code_dark,
        completed_deps: canContinue
      });
    }
    const q2 = "SELECT handle_on_task_status_change($1, $2, $3) AS res;";
    const results1 = await db.query(q2, [userId, body.task_id, body.status_id]);
    const [d] = results1.rows;
    const changeResponse = d.res;

    changeResponse.color_code = changeResponse.color_code + TASK_STATUS_COLOR_ALPHA;

    // notify to all task members of the change
    for (const member of changeResponse.members || []) {
      if (member.user_id === userId) continue;
      NotificationsService.createNotification({
        userId: member.user_id,
        teamId: member.team_id,
        socketId: member.socket_id,
        message: changeResponse.message,
        taskId: body.task_id,
        projectId: changeResponse.project_id
      });
    }

    // Check if the new status is in a "done" category
    if (changeResponse.status_category?.is_done) {
      // Get current progress value
      const progressResult = await db.query(`
        SELECT progress_value, manual_progress
        FROM tasks
        WHERE id = $1
      `, [body.task_id]);

      const currentProgress = progressResult.rows[0]?.progress_value;
      const isManualProgress = progressResult.rows[0]?.manual_progress;

      // Only update if not already 100%
      if (currentProgress !== 100) {
        // Update progress to 100%
        await db.query(`
          UPDATE tasks
          SET progress_value = 100, manual_progress = TRUE
          WHERE id = $1
        `, [body.task_id]);

        log(`Task ${body.task_id} moved to done status - progress automatically set to 100%`, null);

        // Log the progress change to activity logs
        await logProgressChange({
          task_id: body.task_id,
          old_value: currentProgress !== null ? currentProgress.toString() : "0",
          new_value: "100",
          socket
        });

        // If this is a subtask, update parent task progress
        if (body.parent_task) {
          setTimeout(() => {
            socket.emit(SocketEvents.GET_TASK_PROGRESS.toString(), body.parent_task);
          }, 100);
        }
      }
    } else {
      // Task is moving from "done" to "todo" or "doing" - reset manual_progress to FALSE
      // so progress can be recalculated based on subtasks
      await db.query(`
        UPDATE tasks
        SET manual_progress = FALSE
        WHERE id = $1
      `, [body.task_id]);

      log(`Task ${body.task_id} moved from done status - manual_progress reset to FALSE`, null);

      // If this is a subtask, update parent task progress
      if (body.parent_task) {
        setTimeout(() => {
          socket.emit(SocketEvents.GET_TASK_PROGRESS.toString(), body.parent_task);
        }, 100);
      }
    }

    const info = await TasksControllerV2.getTaskCompleteRatio(body.parent_task || body.task_id);

    socket.emit(SocketEvents.TASK_STATUS_CHANGE.toString(), {
      id: body.task_id,
      parent_task: body.parent_task,
      color_code: changeResponse.color_code,
      color_code_dark: changeResponse.color_code_dark,
      complete_ratio: info?.ratio,
      completed_count: info?.total_completed,
      total_tasks_count: info?.total_tasks,
      status_id: body.status_id,
      completed_at: changeResponse.completed_at,
      statusCategory: changeResponse.status_category,
      completed_deps: canContinue
    });

    socket.emit(SocketEvents.GET_TASK_PROGRESS.toString(), {
      id: body.task_id,
      parent_task: body.parent_task,
      complete_ratio: info?.ratio,
      completed_count: info?.total_completed,
      total_tasks_count: info?.total_tasks
    });

    const isAlreadyAssigned = await TasksControllerV2.checkUserAssignedToTask(body.task_id, userId as string, body.team_id);

    if (!isAlreadyAssigned) {
      await assignMemberIfNot(body.task_id, userId as string, body.team_id, _io, socket);
    }

    logStatusChange({
      task_id: body.task_id,
      socket,
      new_value: body.status_id,
      old_value: taskData.status_id
    });

    notifyProjectUpdates(socket, body.task_id);
  } catch (error) {
    log_error(error);
  }
}
