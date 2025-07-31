import {NextFunction} from "express";

import {IWorkLenzRequest} from "../../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../../interfaces/worklenz-response";
import {ServerResponse} from "../../models/server-response";
import {isValidateEmail} from "../../shared/utils";

export default function (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): IWorkLenzResponse | void {
  const {email} = req.body;
  if (!email)
    return res.status(200).send(new ServerResponse(false, null, "Email is required"));

  if (!isValidateEmail(email))
    return res.status(200).send(new ServerResponse(false, null, "Invalid email address"));

  return next();
}
