import { NextFunction } from "express";

import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { isValidateEmail } from "../../shared/utils";

export default function (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): IWorkLenzResponse | void {
  const { team_name, project_name, template_id } = req.body;
  if (template_id && team_name) {
    return next();
  }

  if (!template_id) {
    if (!team_name)
      return res.status(200).send(new ServerResponse(false, null, "Account name is required"));

    if (!project_name)
      return res.status(200).send(new ServerResponse(false, null, "Project name is required"));

    req.body.tasks = Array.isArray(req.body.tasks) ? req.body.tasks : [];
    req.body.team_members = Array.isArray(req.body.team_members) ? req.body.team_members.filter((i: string) => !!i) : [];

    if (!req.body.tasks.length)
      return res.status(200).send(new ServerResponse(false, null, "At least one task is required"));

    for (const email of req.body.team_members) {
      if (email && !isValidateEmail(email))
        return res.status(200).send(new ServerResponse(false, null, "One or more of your team members has invalid email addresses. Please double check and try again.").withTitle("Account setup failed!"));
    }
  }

  return next();
}
