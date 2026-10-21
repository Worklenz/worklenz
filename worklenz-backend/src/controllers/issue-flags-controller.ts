import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";

import db from "../config/db";
import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import {isValidUuid} from "../shared/validation-helpers";

export default class IssueFlagsController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async setBlocked(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const taskId = req.params.taskId;
    const projectId = req.body?.project_id;
    const isBlocked = req.body?.is_blocked;

    if (!isValidUuid(taskId) || !isValidUuid(projectId) || typeof isBlocked !== "boolean") {
      return res.status(400).send(new ServerResponse(false, null, "Invalid request"));
    }

    const q = `
      UPDATE tasks
      SET is_blocked = $3
      WHERE id = $1
        AND project_id = $2
      RETURNING id, is_blocked;`;
    const result = await db.query(q, [taskId, projectId, isBlocked]);
    const [data] = result.rows;
    if (!data) {
      return res.status(404).send(new ServerResponse(false, null, "Task not found"));
    }
    return res.status(200).send(new ServerResponse(true, data));
  }
}
