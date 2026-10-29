import {Server, Socket} from "socket.io";
import db from "../../config/db";
import {SocketEvents} from "../events";

import {log_error} from "../util";
import {verifyProjectSettingsAccessSocket, logUnauthorizedSocketAccess} from "../authorization";
import {reportingRoomName} from "../reporting-room";

export async function on_project_status_change(_io: Server, socket: Socket, data?: string) {
  try {
    const body = JSON.parse(data as string);
    
    const hasAccess = await verifyProjectSettingsAccessSocket(socket, body.project_id);
    if (!hasAccess) {
      logUnauthorizedSocketAccess(socket, 'PROJECT_STATUS_CHANGE', 'project', body.project_id);
      return;
    }

    const q = `UPDATE projects SET status_id = $2 WHERE id = $1
               RETURNING (SELECT t.user_id FROM teams t WHERE t.id = projects.team_id) AS org_owner_id;`;
    const updated = await db.query(q, [body.project_id, body.status_id]);
    const orgOwnerId = updated.rows[0]?.org_owner_id;

    const q2 = "SELECT id,name,color_code,icon FROM sys_project_statuses WHERE id=$1";
    const result = await db.query(q2, [body.status_id]);
    const [d] = result.rows;

    const payload = {
      id: body.project_id,
      status: d.id,
      status_icon: d.icon,
      status_color: d.color_code,
      status_name: d.name
    };
    const room = socket.broadcast.to(body.project_id);
    (orgOwnerId ? room.to(reportingRoomName(orgOwnerId)) : room).emit(SocketEvents.PROJECT_STATUS_CHANGE.toString(), payload);
    socket.emit(SocketEvents.PROJECT_STATUS_CHANGE.toString(), payload);
  } catch (error) {
    log_error(error);
  }
}
