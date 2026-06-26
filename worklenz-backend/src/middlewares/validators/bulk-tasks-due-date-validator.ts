import {NextFunction} from "express";

import {IWorkLenzRequest} from "../../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../../interfaces/worklenz-response";
import {ServerResponse} from "../../models/server-response";

export default function (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): IWorkLenzResponse | void {
  const {end_date, tasks} = req.body;
  
  // end_date can be null (to clear due date) or a valid date string
  if (end_date !== null && end_date !== undefined && typeof end_date !== 'string') {
    return res.status(400).send(new ServerResponse(false, null, "Invalid due date format"));
  }
  
  if (!Array.isArray(tasks)) {
    return res.status(400).send(new ServerResponse(false, null, "Tasks must be an array"));
  }

  return next();
}
