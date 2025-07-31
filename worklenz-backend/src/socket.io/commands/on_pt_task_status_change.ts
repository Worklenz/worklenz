import { Server, Socket } from "socket.io";
import { log_error } from "../util";
import db from "../../config/db";
import { TASK_STATUS_COLOR_ALPHA } from "../../shared/constants";
import { SocketEvents } from "../events";

export async function on_pt_task_status_change(_io: Server, socket: Socket, data?: string) {
    try {
        const body = JSON.parse(data as string);
    
        const q2 = "SELECT handle_on_pt_task_status_change($1, $2) AS res;";
        const results1 = await db.query(q2, [body.task_id, body.status_id]);
        const [d] = results1.rows;
        const changeResponse = d.res;
    
        changeResponse.color_code = changeResponse.color_code + TASK_STATUS_COLOR_ALPHA;
    
        socket.emit(SocketEvents.PT_TASK_STATUS_CHANGE.toString(), {
          id: body.task_id,
          parent_task: body.parent_task,
          color_code: changeResponse.color_code,
          status_id: body.status_id,
          statusCategory: changeResponse.status_category
        });
      } catch (e) {
        log_error(e);
    }
}