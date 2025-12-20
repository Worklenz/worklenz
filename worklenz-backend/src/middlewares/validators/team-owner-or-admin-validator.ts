import { NextFunction } from "express";

import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";

export default function (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): IWorkLenzResponse | void {
  const isSuperAdmin = req.user?.id === "00000000-0000-0000-0000-000000000000";
  if (req.user && (req.user.owner || req.user.is_admin || isSuperAdmin))
    return next();
  return res.status(401).send(new ServerResponse(false, null, "You are not authorized to perform this action"));
}
