import {NextFunction} from "express";

import {IWorkLenzRequest} from "../../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../../interfaces/worklenz-response";
import {ServerResponse} from "../../models/server-response";

export default function (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): IWorkLenzResponse | void {
  const {priority_id, tasks} = req.body;
  if (!priority_id || !Array.isArray(tasks))
    return res.status(400).send(new ServerResponse(false, null));

  return next();
}
