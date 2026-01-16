import {NextFunction, Request, Response} from "express";

import {ServerResponse} from "../../models/server-response";
import {isValidateEmail} from "../../shared/utils";

export default function (req: Request, res: Response, next: NextFunction) {
  const {name, email, team_name} = req.body;

  if (!name) return res.status(200).send(new ServerResponse(false, null, "Name is required"));
  if (!email) return res.status(200).send(new ServerResponse(false, null, "Email is required"));
  if (!isValidateEmail(email)) return res.status(200).send(new ServerResponse(false, null, "Invalid email address"));
  
  // Only set team_name from name if team_name is not provided
  if (!team_name) {
    req.body.team_name = name.trim();
  }

  return next();
}
