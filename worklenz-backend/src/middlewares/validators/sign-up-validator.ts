import {NextFunction, Request, Response} from "express";

import {ServerResponse} from "../../models/server-response";
import {isValidateEmail} from "../../shared/utils";

export default function (req: Request, res: Response, next: NextFunction) {
  const {name, email} = req.body;
  if (!name) return res.status(200).send(new ServerResponse(false, null, "Name is required"));
  if (!email) return res.status(200).send(new ServerResponse(false, null, "Email is required"));
  if (!isValidateEmail(email)) return res.status(200).send(new ServerResponse(false, null, "Invalid email address"));

  return next();
}
