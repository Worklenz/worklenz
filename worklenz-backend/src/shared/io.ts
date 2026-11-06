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

  /**
   * Broadcast to everyone currently in a project room.
   * Prefer this over `getSocketById(sender).to(room)` — room fan-out must not
   * depend on the sender's DB socket_id still being valid.
   */
  public static emitToProjectRoom(
    projectId: string,
    event: SocketEvents | string,
    data?: unknown,
    options?: { excludeSocketId?: string }
  ) {
    if (!projectId || !this.instance) return;
    const eventName = typeof event === "string" ? event : event.toString();
    if (options?.excludeSocketId) {
      this.instance.to(projectId).except(options.excludeSocketId).emit(eventName, data);
    } else {
      this.instance.to(projectId).emit(eventName, data);
    }
  }

  /** Broadcast to sockets currently in an arbitrary room (e.g. Client Portal team/client rooms). */
  public static emitToRoom(room: string, event: SocketEvents | string, data?: unknown) {
    if (!room || !this.instance) return;
    const eventName = typeof event === "string" ? event : event.toString();
    this.instance.to(room).emit(eventName, data);
  }

  public static emit(event: SocketEvents | string, socketId: string, data?: any) {
    if (!socketId) return;
    const eventName = typeof event === "string" ? event : event.toString();
    this.getSocketById(socketId)?.emit(eventName, data);
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
