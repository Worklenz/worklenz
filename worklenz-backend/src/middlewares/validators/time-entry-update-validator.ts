import { NextFunction } from "express";

import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { getBackdateViolation } from "../../shared/timelog-backdate-restriction";
import { isTeamOwner, isTeamAdmin } from "../../shared/team-permissions";

/**
 * Body validation for the Time Entries page's edit route (PUT /task-time-log/entries/:id).
 *
 * Same checks as taskTimeLogValidator (the task drawer's route, which is left untouched), with
 * two differences: failures carry a readable message instead of a bare 400, and owners/admins —
 * who may edit other members' entries here — keep the "date unchanged is still allowed"
 * backdate exemption for those entries too (decided from the session, never from the body).
 */
export default async function (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): Promise<IWorkLenzResponse | void> {
  const { seconds_spent, formatted_start } = req.body || {};

  if (!seconds_spent || !formatted_start) {
    return res.status(400).send(new ServerResponse(false, null, "A duration and a start time are required."));
  }

  const violation = await getBackdateViolation(
    formatted_start,
    req.user?.id,
    req.user?.team_id,
    req.params.id,
    isTeamOwner(req.user) || isTeamAdmin(req.user)
  );
  if (violation) return res.status(400).send(new ServerResponse(false, null, violation));

  return next();
}
