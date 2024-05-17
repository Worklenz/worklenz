import {Server, Socket} from "socket.io";
import db from "../../config/db";

import {log} from "../util";
import {SocketEvents} from "../events";

export async function on_login(_io: Server, socket: Socket, id?: string) {
  log(socket.id, `user connected`);
  try {
    const q = "UPDATE users SET socket_id = $1 WHERE id = $2";
    await db.query(q, [socket.id, id]);
    socket.emit(SocketEvents.LOGIN.toString());
  } catch (error) {
    // ignored
  }
}
