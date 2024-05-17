import {Server, Socket} from "socket.io";
import db from "../../config/db";
import {SocketEvents} from "../events";
import {log_error} from "../util";


export async function on_schedule_member_end_date_change(_io: Server, socket: Socket, data?: string) {
  try {
    const q = `UPDATE project_member_allocations
               SET allocated_to = $4
               WHERE id = $3 AND project_id = $1 AND team_member_id = $2`;

    const body = JSON.parse(data as string);

    const result = await db.query(q, [body.project_id, body.team_member_is, body.allocation_ids[0], body.allocated_to]);

    if (result && body.allocation_ids.length > 1) {
      for (let i = 1; i < body.allocation_ids.length; i++) {
        const dq = `DELETE FROM project_member_allocations WHERE id = $1`;
        await db.query(dq, [body.allocation_ids[i]]);
      }
    }

    socket.emit(SocketEvents.SCHEDULE_MEMBER_END_DATE_CHANGE.toString(), {
      id : body.allocation_ids[0],
      date: body.allocated_to
    });

    return;
  } catch (error) {
    log_error(error);
  }

  socket.emit(SocketEvents.SCHEDULE_MEMBER_END_DATE_CHANGE.toString(), null);

 }
