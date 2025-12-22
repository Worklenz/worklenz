import {Server, Socket} from "socket.io";
import db from "../../config/db";

import {getLoggedInUserIdFromSocket, log} from "../util";
import {SocketEvents} from "../events";

export async function on_login(_io: Server, socket: Socket) {
  log(socket.id, `user connected`);
  try {
    const userId = getLoggedInUserIdFromSocket(socket);
    if (!userId) {
      socket.emit(SocketEvents.LOGIN.toString(), {success: false});
      return;
    }

    const q = `
      INSERT INTO user_sockets (socket_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (socket_id) DO UPDATE SET user_id = EXCLUDED.user_id;
    `;
    await db.query(q, [socket.id, userId]);
    await db.query("UPDATE users SET socket_id = $1 WHERE id = $2", [socket.id, userId]);
    socket.emit(SocketEvents.LOGIN.toString());
  } catch (error) {
    // ignored
  }
}
