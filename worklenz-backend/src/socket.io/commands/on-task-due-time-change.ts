import { Server, Socket } from "socket.io";
import db from "../../config/db";
import { SocketEvents } from "../events";
import { notifyProjectUpdates } from "../util";
import { log_error } from "../../shared/utils";
import { verifyTaskAccessSocket, logUnauthorizedSocketAccess } from "../authorization";

export async function on_task_due_time_change(_io: Server, socket: Socket, data?: string) {
  try {
    const body = JSON.parse(data as string);

    const hasAccess = await verifyTaskAccessSocket(socket, body.task_id);
    if (!hasAccess) {
      logUnauthorizedSocketAccess(socket, "TASK_DUE_TIME_CHANGE", "task", body.task_id);
      return;
    }

    // due_time is expected as "HH:mm" or null to clear
    const q = `UPDATE tasks SET due_time = $2 WHERE id = $1 RETURNING due_time;`;
    const result = await db.query(q, [body.task_id, body.due_time ?? null]);
    const [d] = result.rows;

    // Return the stored value as "HH:mm" string or null
    const storedTime = d.due_time
      ? String(d.due_time).substring(0, 5) // trim seconds if present: "HH:mm:ss" -> "HH:mm"
      : null;

    socket.emit(SocketEvents.TASK_DUE_TIME_CHANGE.toString(), {
      id: body.task_id,
      due_time: storedTime,
    });

    notifyProjectUpdates(socket, body.task_id);
    return;
  } catch (error) {
    log_error(error);
  }

  socket.emit(SocketEvents.TASK_DUE_TIME_CHANGE.toString(), null);
}
