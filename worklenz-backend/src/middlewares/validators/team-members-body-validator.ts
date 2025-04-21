import {NextFunction} from "express";

import {IWorkLenzRequest} from "../../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../../interfaces/worklenz-response";
import {ServerResponse} from "../../models/server-response";
import {isValidateEmail} from "../../shared/utils";

export default function (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): IWorkLenzResponse | void {
  const {emails} = req.body;

  if (!Array.isArray(emails) || !emails.length)
    return res.status(200).send(new ServerResponse(false, null, "Email addresses cannot be empty"));

  for (const email of emails) {
    if (!isValidateEmail(email.trim()))
      return res.status(200).send(new ServerResponse(false, null, "Invalid email address"));
  }

  return next();
}
