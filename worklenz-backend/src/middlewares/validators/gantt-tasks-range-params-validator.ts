import {NextFunction} from "express";

import {IWorkLenzRequest} from "../../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../../interfaces/worklenz-response";
import {ServerResponse} from "../../models/server-response";

export default function (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): IWorkLenzResponse | void {
  const {project_id, start_date, end_date} = req.query;
  if (!project_id)
    return res.status(200).send(new ServerResponse(false, null, "Project ID is required"));

  if (!start_date)
    return res.status(200).send(new ServerResponse(false, null, "Start date is required"));

  if (!end_date)
    return res.status(200).send(new ServerResponse(false, null, "End date is required"));

  return next();
}
