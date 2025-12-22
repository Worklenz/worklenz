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
      const q = `SELECT socket_id FROM user_sockets WHERE user_id = $1;`;
      const result = await db.query(q, [id]);
      if (!result.rows.length) return;
      result.rows.forEach((row: { socket_id: string }) => {
        this.emit(event, row.socket_id, data);
      });
    } catch (error) {
      // ignored
    }
  }

  public static async emitByTeamMemberId(id: string, userId: string | null, event: SocketEvents, data?: any) {
    try {
      const q = `
        SELECT us.socket_id
        FROM team_members tm
        JOIN user_sockets us ON us.user_id = tm.user_id
        WHERE tm.id = $2
          AND tm.user_id != $1;
      `;
      const result = await db.query(q, [userId, id]);
      if (!result.rows.length) return;
      result.rows.forEach((row: { socket_id: string }) => {
        this.emit(event, row.socket_id, data);
      });
    } catch (error) {
      // ignored
    }
  }
}
