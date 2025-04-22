import {Socket} from "socket.io";
import {ISocketSession} from "../interfaces/socket-session";
import db from "../config/db";
import {SocketEvents} from "./events";

/** [Socket IO] Log a socket io debug log */
export function log(id: string, value: any) {
  console.log(`[${id}] ${value}`);
}

/** [Socket IO] Log a socket io error */
export function log_error(error: any) {
  console.trace(`[SOCKET.IO]`, error);
}

export function getLoggedInUserIdFromSocket(socket: Socket): string | null {
  const {session} = socket.request as ISocketSession;
  if (session?.passport?.user?.id) {
    return session.passport.user.id;
  }
  return null;
}

export async function notifyProjectUpdates(socket: Socket, taskId: string) {
  try {
    const result = await db.query("SELECT project_id FROM tasks WHERE id = $1;", [taskId]);
    const [data] = result.rows;
    if (data.project_id) {
      socket.to(data.project_id).emit(SocketEvents.PROJECT_UPDATES_AVAILABLE.toString());
    }
  } catch (error) {
    // ignore
  }
}
