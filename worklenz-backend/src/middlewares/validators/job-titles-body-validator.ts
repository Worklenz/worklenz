import {NextFunction} from "express";

import {IWorkLenzRequest} from "../../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../../interfaces/worklenz-response";
import {ServerResponse} from "../../models/server-response";

export default function (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): IWorkLenzResponse | void {
  const {name} = req.body;
  if (!name || name.trim() === "")
    return res.status(200).send(new ServerResponse(false, null, "Name is required"));

  req.body.name = req.body.name.trim();

  return next();
}
