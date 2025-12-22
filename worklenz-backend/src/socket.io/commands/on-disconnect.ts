import {Server, Socket} from "socket.io";
import db from "../../config/db";

import {log} from "../util";

export async function on_disconnect(io: Server, socket: Socket, reason?: string) {
  log(socket.id, `disconnected (${reason})`);
  try {
    const userResult = await db.query("SELECT user_id FROM user_sockets WHERE socket_id = $1", [socket.id]);
    const userId = userResult.rows[0]?.user_id;

    await db.query("DELETE FROM user_sockets WHERE socket_id = $1", [socket.id]);

    if (userId) {
      const remaining = await db.query(
        "SELECT socket_id FROM user_sockets WHERE user_id = $1 ORDER BY connected_at DESC LIMIT 1",
        [userId]
      );
      const nextSocketId = remaining.rows[0]?.socket_id || null;
      await db.query("UPDATE users SET socket_id = $1 WHERE id = $2", [nextSocketId, userId]);
    }
  } catch (error) {
    // ignored
  }
}
