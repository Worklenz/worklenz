import {Server} from "socket.io";
import db from "../config/db";
import {SocketEvents} from "../socket.io/events";

export class IO {
  private static instance: Server | null = null;

  public static setInstance(io: Server) {
    this.instance = io;
  }

  public static getInstance() {
    return this.instance;
  }

  public static getSocketById(socketId: string) {
    return this.instance?.sockets.sockets?.get(socketId) || null;
  }

  public static emit(event: SocketEvents, socketId: string, data?: any) {
    this.getSocketById(socketId)?.emit(event.toString(), data);
  }

  public static async emitByUserId(id: string, userId: string | null, event: SocketEvents, data?: any) {
    try {
      if (id === userId) return;
      const q = `SELECT socket_id FROM users WHERE id = $1;`;
      const result = await db.query(q, [id]);
      const [user] = result.rows;
      if (!user) return;
      this.emit(event, user.socket_id, data);
    } catch (error) {
      // ignored
    }
  }

  public static async emitByTeamMemberId(id: string, userId: string | null, event: SocketEvents, data?: any) {
    try {
      const q = `SELECT socket_id FROM users WHERE id != $1 AND id IN (SELECT user_id FROM team_members WHERE id = $2);`;
      const result = await db.query(q, [userId, id]);
      const [user] = result.rows;
      if (!user) return;
      this.emit(event, user.socket_id, data);
    } catch (error) {
      // ignored
    }
  }
}
