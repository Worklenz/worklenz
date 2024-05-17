import {NextFunction} from "express";

import {IWorkLenzRequest} from "../../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../../interfaces/worklenz-response";
import {ServerResponse} from "../../models/server-response";

export default function (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): IWorkLenzResponse | void {
  const {name, project_id} = req.body;
  if (!name)
    return res.status(200).send(new ServerResponse(false, null, "Name is required"));
  if (!project_id)
    return res.status(200).send(new ServerResponse(false, null, "Project is required"));

  return next();
}
