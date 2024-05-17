import { Server, Socket } from "socket.io";
import { getLoggedInUserIdFromSocket, log_error } from "../util";
import db from "../../config/db";
import { SocketEvents } from "../events";
import { UNMAPPED } from "../../shared/constants";
import { GroupBy } from "../../controllers/project-templates/pt-tasks-controller-base";
import TasksControllerV2 from "../../controllers/tasks-controller-v2";
import { assignMemberIfNot } from "./on-quick-assign-or-remove";

interface ChangeRequest {
    from_index: number; // from sort_order
    to_index: number; // to sort_order
    template_id: string;
    from_group: string;
    to_group: string;
    group_by: string;
    to_last_index: boolean;
    task: {
        id: string;
        template_id: string;
        status: string;
        priority: string;
    };
    team_id: string
}

interface Config {
    from_index: number;
    to_index: number;
    task_id: string;
    from_group: string | null;
    to_group: string | null;
    template_id: string;
    group_by: string;
    to_last_index: boolean;
}

async function emitSortOrderChange(data: ChangeRequest, socket: Socket) {
    const q = `
      SELECT id, sort_order
      FROM cpt_tasks
      WHERE template_id = $1
      ORDER BY sort_order;
    `;
    const tasks = await db.query(q, [data.template_id]);
    socket.emit(SocketEvents.PT_TASK_SORT_ORDER_CHANGE.toString(), tasks.rows);
}

function updateUnmappedStatus(config: Config) {
    if (config.to_group === UNMAPPED)
        config.to_group = null;
    if (config.from_group === UNMAPPED)
        config.from_group = null;
}

export async function on_pt_task_sort_order_change(_io: Server, socket: Socket, data: ChangeRequest) {
    try {
        const q = `SELECT handle_pt_task_list_sort_order_change($1);`;

        const config: Config = {
          from_index: data.from_index,
          to_index: data.to_index,
          task_id: data.task.id,
          from_group: data.from_group,
          to_group: data.to_group,
          template_id: data.template_id,
          group_by: data.group_by,
          to_last_index: Boolean(data.to_last_index)
        };

        if (config.group_by === GroupBy.PHASE) {
          updateUnmappedStatus(config);
        }

        await db.query(q, [JSON.stringify(config)]);
        await emitSortOrderChange(data, socket);

        return;
      } catch (error) {
        log_error(error);
      }

      socket.emit(SocketEvents.PT_TASK_SORT_ORDER_CHANGE.toString(), []);
}
