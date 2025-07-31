import {Server, Socket} from "socket.io";
import db from "../../config/db";

import {log} from "../util";

export async function on_disconnect(io: Server, socket: Socket, reason?: string) {
  log(socket.id, `disconnected (${reason})`);
  try {
    const q = "UPDATE users SET socket_id = NULL WHERE socket_id = $1";
    await db.query(q, [socket.id]);
  } catch (error) {
    // ignored
  }
}
