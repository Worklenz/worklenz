import { NextFunction } from "express";

import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { getBackdateViolation } from "../../shared/timelog-backdate-restriction";
import { getProjectStartDateViolation } from "../../shared/timelog-project-date-restriction";

export default async function (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): Promise<IWorkLenzResponse | void> {

  const {id, seconds_spent, created_at, formatted_start, new_task_id} = req.body;

  if (!id || !seconds_spent || !formatted_start) return res.sendStatus(400);

  const projectViolation = await getProjectStartDateViolation({
    taskId: new_task_id || id,
    workLogId: req.params.id || null,
    formattedStart: formatted_start,
    userId: req.user?.id,
  });
  if (projectViolation) return res.status(400).send(new ServerResponse(false, null, projectViolation));

  // On PUT the route param carries the work log id, which lets the check exempt
  // edits that leave the log's date untouched.
  const violation = await getBackdateViolation(
    formatted_start,
    req.user?.id,
    req.user?.team_id,
    req.params.id
  );
  if (violation) return res.status(400).send(new ServerResponse(false, null, violation));

  return next();
}
