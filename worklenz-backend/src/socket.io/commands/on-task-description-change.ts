import { Server, Socket } from "socket.io";
import db from "../../config/db";
import { SocketEvents } from "../events";

import { log_error, notifyProjectUpdates, getLoggedInUserIdFromSocket } from "../util";
import { sanitizeRichTextDescription } from "../../shared/utils";
import {
  getTaskDetails,
  logDescriptionChange,
} from "../../services/activity-logs/activity-logs.service";
import {verifyNonGuestTaskAccessSocket, logUnauthorizedSocketAccess} from "../authorization";
import { syncTaskDescriptionLinks } from "../../shared/url-extractor";

type DescriptionChangeAck = (response: { success: boolean; error?: string }) => void;

export async function on_task_description_change(
  _io: Server,
  socket: Socket,
  data?: string,
  callback?: DescriptionChangeAck
) {
  try {
    const body = JSON.parse(data as string);

    const hasAccess = await verifyNonGuestTaskAccessSocket(socket, body.task_id);
    if (!hasAccess) {
      logUnauthorizedSocketAccess(socket, 'TASK_DESCRIPTION_CHANGE', 'task', body.task_id);
      callback?.({ success: false, error: "You don't have access to update this task." });
      return;
    }

    const q = `UPDATE tasks
               SET description = $2
               WHERE id = $1
               RETURNING description;`;
    const task_data = await getTaskDetails(body.task_id, "description");

    const description =
      (body.description || "")
        .replace(/(^([ ]*<p><br><\/p>)*)|((<p><br><\/p>)*[ ]*$)/gi, "")
        .trim() || null;

    await db.query(q, [body.task_id, sanitizeRichTextDescription(description)]);

    // Sync any URLs in the description into the project Links tab
    try {
      const linkRow = await db.query(
        `SELECT t.project_id, p.team_id
           FROM tasks t
           LEFT JOIN projects p ON p.id = t.project_id
          WHERE t.id = $1`,
        [body.task_id]
      );
      const meta = linkRow.rows[0];
      if (meta?.project_id && meta?.team_id) {
        const userId = getLoggedInUserIdFromSocket(socket) ?? undefined;
        void syncTaskDescriptionLinks(meta.project_id, body.task_id, meta.team_id, description || "", userId);
      }
    } catch (e) {
      log_error(e);
    }

    socket.emit(SocketEvents.TASK_DESCRIPTION_CHANGE.toString(), {
      id: body.task_id,
      description,
      parent_task: body.parent_task,
    });

    if (description && task_data.description) {
      logDescriptionChange({
        task_id: body.task_id,
        socket,
        new_value: description,
        old_value: task_data.description,
      });
    }

    notifyProjectUpdates(socket, body.task_id);
    // }
    callback?.({ success: true });
  } catch (error) {
    log_error(error);
    callback?.({ success: false, error: 'Failed to save the description. Please try again.' });
  }
}
