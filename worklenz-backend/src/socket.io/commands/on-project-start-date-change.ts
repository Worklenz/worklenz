import {Server, Socket} from "socket.io";
import db from "../../config/db";
import {SocketEvents} from "../events";

import {log_error, parseSocketPayload} from "../util";

export async function on_project_start_date_change(_io: Server, socket: Socket, data?: string) {
  try {
    const body = parseSocketPayload<any>(data as string);

    if (!body) return;
    await db.query(q, [body.project_id, body.start_date]);

    socket.emit(SocketEvents.PROJECT_START_DATE_CHANGE.toString(), {
      id: body.project_id,
      start_date: body.start_date
    });
  } catch (error) {
    log_error(error);
  }
}