import {NextFunction} from "express";

import {IWorkLenzRequest} from "../../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../../interfaces/worklenz-response";
import {ServerResponse} from "../../models/server-response";

export default function (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): IWorkLenzResponse | void {
  const {hash, password, user} = req.body;
  if (!password)
    return res.status(200).send(new ServerResponse(false, null, "Password is required"));

  if (!hash || !user)
    return res.status(200).send(new ServerResponse(false, null, "An unknown error has occurred. Please try again."));
  return next();
}
