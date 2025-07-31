import {NextFunction} from "express";
import {IWorkLenzRequest} from "../../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../../interfaces/worklenz-response";

import {ServerResponse} from "../../models/server-response";

export default function (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): IWorkLenzResponse | void {
  const {name, color_code, status_id} = req.body;
  if (!status_id || status_id.trim() === "")
    return res.status(400).send(new ServerResponse(false, null));
  if (!name || name.trim() === "")
    return res.status(200).send(new ServerResponse(false, null, "Project name is required"));
  if (!color_code || color_code.trim() === "")
    return res.status(200).send(new ServerResponse(false, null, "Color code is required"));

  req.body.name = req.body.name.trim();

  if (req.body.name.length > 100)
    return res.status(200).send(new ServerResponse(false, null, "Project name length exceeded!"));

  if (req.body.notes && req.body.notes.length > 200)
    return res.status(200).send(new ServerResponse(false, null, "Project note length exceeded!"));

  if (req.body.working_days && !(Number.isInteger(req.body.working_days)))
    return res.status(200).send(new ServerResponse(false, null, "Please use integer values"));

  if (req.body.man_days && !(Number.isInteger(req.body.man_days)))
    return res.status(200).send(new ServerResponse(false, null, "Please use integer values"));

  if (req.body.hours_per_day && !(Number.isInteger(req.body.hours_per_day)))
    return res.status(200).send(new ServerResponse(false, null, "Please use integer values"));

  return next();
}
