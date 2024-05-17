import {NextFunction} from "express";

import {IWorkLenzRequest} from "../../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../../interfaces/worklenz-response";
import {ServerResponse} from "../../models/server-response";
import {getRandomColorCode, sanitize, toMinutes, toRound} from "../../shared/utils";

export default function (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): IWorkLenzResponse | void {
  const {name, priority_id, status_id, assignees, project_id, labels} = req.body;
  if (!name?.trim()?.length)
    return res.status(200).send(new ServerResponse(false, null, "Name is required"));
  if (!priority_id)
    return res.status(200).send(new ServerResponse(false, null, "Priority is required"));
  if (!status_id)
    return res.status(200).send(new ServerResponse(false, null, "Status is required"));
  if (!project_id)
    return res.status(200).send(new ServerResponse(false, null, "Project is required"));

  req.body.total_hours = isNaN(+req.body.total_hours) || req.body.total_hours > 1000 ? 0 : toRound(req.body.total_hours);
  req.body.total_minutes = isNaN(+req.body.total_minutes) || req.body.total_minutes > 1000 ? 0 : toRound(req.body.total_minutes);

  req.body.assignees = Array.isArray(assignees) ? assignees : [];
  req.body.labels = Array.isArray(labels) ? labels : [];

  req.body.reporter_id = req.user?.id || null;
  req.body.total_minutes = toMinutes(req.body.total_hours, req.body.total_minutes);
  req.body.team_id = req.user?.team_id || null;

  req.body.inline = req.query.inline || false;

  const labelsJson = [];
  for (const label of req.body.labels) {
    labelsJson.push({
      name: label,
      color: getRandomColorCode()
    });
  }

  req.body.labels = labelsJson;

  if (req.body.description) {
    if (req.body.description.length > 4000)
      return res.status(200).send(new ServerResponse(false, null, "Task description length exceeded!"));
    req.body.description = sanitize(req.body.description);
  }

  if (req.body.name.length > 100)
    return res.status(200).send(new ServerResponse(false, null, "Task name length exceeded!"));

  return next();
}
