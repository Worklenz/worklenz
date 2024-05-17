import {NextFunction} from "express";

import {IWorkLenzRequest} from "../../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../../interfaces/worklenz-response";
import {ServerResponse} from "../../models/server-response";

export default function (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): IWorkLenzResponse | void {
  if (req.user?.owner)
    return next();
  return res.status(401).send(new ServerResponse(false, null, "You are not authorized to perform this action"));
}
