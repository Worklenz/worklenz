import {NextFunction} from "express";
import {IWorkLenzRequest} from "../../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../../interfaces/worklenz-response";
import {ServerResponse} from "../../models/server-response";

export default function (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): IWorkLenzResponse | void {
  const {name, end_date, project_id} = req.body;
  if (!name?.trim().length)
    return res.status(200).send(new ServerResponse(false, null, "Name is required"));
  if (!end_date?.trim().length)
    return res.status(200).send(new ServerResponse(false, null, "Due date is required"));
  if (!project_id)
    return res.status(200).send(new ServerResponse(false, null, "Project is required"));

  req.body.reporter_id = req.user?.id ?? null;
  req.body.team_id = req.user?.team_id ?? null;

  req.body.inline = req.query.inline || false;

  if (req.body.name.length > 100)
    return res.status(200).send(new ServerResponse(false, null, "Task name length exceeded!"));

  return next();
}
