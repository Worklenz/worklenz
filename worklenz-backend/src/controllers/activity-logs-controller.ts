import moment from "moment";
import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";

import db from "../config/db";

import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import {formatDuration, formatLogText, getColor} from "../shared/utils";

export default class ActivitylogsController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {id} = req.params;
    const q = `SELECT get_activity_logs_by_task($1) AS activity_logs;`;
    const result = await db.query(q, [id]);
    const [data] = result.rows;

    // Automated status changes (e.g. from GitHub) carry their source in next_string.
    const sources = await db.query(
      `SELECT created_at, next_string FROM task_activity_logs
       WHERE task_id = $1 AND attribute_type = 'status' AND next_string IS NOT NULL`,
      [id],
    );
    const sourceByTime = new Map<number, string>(
      sources.rows.map(r => [new Date(r.created_at).getTime(), r.next_string]),
    );

    for (const log of data.activity_logs.logs) {
      if (log.attribute_type === "status") {
        log.source = sourceByTime.get(new Date(log.created_at).getTime()) ?? null;
      }
      if (log.attribute_type === "estimation") {
        log.previous = formatDuration(moment.duration(log.previous, "minutes"));
        log.current = formatDuration(moment.duration(log.current, "minutes"));
      }
      if (log.assigned_user) log.assigned_user.color_code = getColor(log.assigned_user.name);
      log.done_by.color_code = getColor(log.done_by.name);
      log.log_text = await formatLogText(log);
      log.attribute_type = log.attribute_type?.replace(/_/g, " ");
    }
    data.activity_logs.color_code = getColor(data.activity_logs.name);

    return res.status(200).send(new ServerResponse(true, data.activity_logs));
  }
}
