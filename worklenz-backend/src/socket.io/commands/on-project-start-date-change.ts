import {Server, Socket} from "socket.io";
import db from "../../config/db";
import {SocketEvents} from "../events";
import momentTime from "moment-timezone";

import {log_error} from "../util";
import {logUnauthorizedSocketAccess, verifyProjectSettingsAccessSocket} from "../authorization";
import {reportingRoomName} from "../reporting-room";

export async function on_project_start_date_change(
  _io: Server,
  socket: Socket,
  data?: string,
  callback?: (response: { success: boolean; error?: string }) => void
) {
  try {
    const body = JSON.parse(data as string);

    const hasAccess = await verifyProjectSettingsAccessSocket(socket, body.project_id);
    if (!hasAccess) {
      logUnauthorizedSocketAccess(socket, "PROJECT_START_DATE_CHANGE", "project", body.project_id);
      callback?.({success: false, error: "You do not have access to this project."});
      return;
    }

    // Use the exact same pattern as tasks - direct assignment
    const q = `UPDATE projects SET start_date = $2 WHERE id = $1 RETURNING start_date, (SELECT t.user_id FROM teams t WHERE t.id = projects.team_id) AS org_owner_id;`;
    const result = await db.query(q, [body.project_id, body.start_date]);
    
    const [d] = result.rows;

    const responseDate = d.start_date ? momentTime.utc(d.start_date).format('YYYY-MM-DD') : null;

    const payload = {
      project_id: body.project_id,
      start_date: responseDate
    };
    // Owner/admin reporting overview clients are not in the project room; reach them via the
    // org-scoped reporting room (union with the project room, so no duplicate delivery).
    const room = socket.broadcast.to(body.project_id);
    (d.org_owner_id ? room.to(reportingRoomName(d.org_owner_id)) : room).emit(SocketEvents.PROJECT_START_DATE_CHANGE.toString(), payload);
    socket.emit(SocketEvents.PROJECT_START_DATE_CHANGE.toString(), payload);
    callback?.({success: true});
  } catch (error) {
    console.error('[PROJECT_START_DATE_CHANGE] Error:', error);
    log_error(error);
    callback?.({success: false, error: "Failed to save the date. Please try again."});
  }
}
