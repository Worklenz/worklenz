import { NextFunction } from "express";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { isTeamLead } from "../../shared/team-permissions";

/**
 * Middleware to deny team leads access to finance endpoints
 * Team leads should not have access to project finance data
 */
export default async function teamLeadFinanceValidator(
  req: IWorkLenzRequest,
  res: IWorkLenzResponse,
  next: NextFunction
): Promise<IWorkLenzResponse | void> {
  const userId = req.user?.id;
  const teamId = req.user?.team_id;

  if (!userId || !teamId) {
    return res.status(400).send(new ServerResponse(false, null, "Missing user context"));
  }

  // Check if user is a team lead
  const userIsTeamLead = await isTeamLead(userId, teamId);
  
  if (userIsTeamLead) {
    return res.status(403).send(new ServerResponse(false, null, "Team leads do not have access to project finance"));
  }

  return next();
}
