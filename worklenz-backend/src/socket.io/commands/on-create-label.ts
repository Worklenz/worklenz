import {Server, Socket} from "socket.io";
import db from "../../config/db";
import WorklenzControllerBase from "../../controllers/worklenz-controller-base";
import {getRandomColorCode} from "../../shared/utils";
import {SocketEvents} from "../events";

import {log_error} from "../util";
import {logLabelsUpdate} from "../../services/activity-logs/activity-logs.service";

export async function on_create_label(_io: Server, socket: Socket, data?: string) {
  try {
    const body = JSON.parse(data as string);
    if (body.label?.length > 30) return;

    body.color = getRandomColorCode();

    const q = `SELECT assign_or_create_label($1, $2, $3, $4) AS label;`;
    const result = await db.query(q, [body.team_id, body.task_id, body.label, body.color]);
    const [d] = result.rows;
    const labelId = d.label?.id;

    if (labelId) {
      const q2 = `
        SELECT task_labels.label_id AS id,
          (SELECT name FROM team_labels WHERE id = task_labels.label_id) AS name,
          (SELECT color_code FROM team_labels WHERE id = task_labels.label_id)
        FROM task_labels
        WHERE task_id = $1
        ORDER BY name
      `;
      const result2 = await db.query(q2, [body.task_id]);

      const labels = WorklenzControllerBase.createTagList(result2.rows, 2);

      const newLabel = {
        id: labelId,
        selected: true,
        color_code: body.color,
        name: body.label.trim()
      };

      socket.emit(SocketEvents.CREATE_LABEL.toString(), {
        id: body.task_id,
        parent_task: body.parent_task,
        new_label: newLabel,
        is_new: !!d.label?.is_new,
        all_labels: result2.rows,
        labels
      });

      logLabelsUpdate({
        task_id: body.task_id,
        socket,
        new_value: labelId,
        old_value: null
      });

    }
  } catch (error) {
    log_error(error);
  }
}
