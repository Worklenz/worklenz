import {NextFunction} from "express";

import {IWorkLenzRequest} from "../../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../../interfaces/worklenz-response";
import {ServerResponse} from "../../models/server-response";

export default function (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): IWorkLenzResponse | void {
  const {status_id, task_id} = req.params;

  if (!status_id || !task_id)
    return res.status(200).send(new ServerResponse(false, null, "Updating status failed!"));
  return next();
}
