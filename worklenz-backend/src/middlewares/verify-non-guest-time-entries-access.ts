import { NextFunction } from "express";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import { log_error } from "../shared/utils";
import { isGuestForActiveTeam } from "../shared/team-permissions";

/**
 * Blocks guest team members from the Time Entries read endpoints. Time
 * Entries isn't scoped to a single project id (unlike verifyGuestViewAccess),
 * so this checks the team-wide team_members.is_guest flag for the user's
 * active team, same as verifyNonGuestPlannerAccess. Applied to read routes
 * only — mutation and task-access-gated routes are a separate concern.
 */
export default async function verifyNonGuestTimeEntriesAccess(
  req: IWorkLenzRequest,
  res: IWorkLenzResponse,
  next: NextFunction
) {
  const userId = req.user?.id;
  const teamId = req.user?.team_id;

  if (!userId || !teamId) return next();

  try {
    const isGuest = await isGuestForActiveTeam(userId, teamId);

    if (isGuest) {
      return res.status(403).send(
        new ServerResponse(false, null, "Guests do not have access to Time Entries.")
      );
    }

    return next();
  } catch (error) {
    log_error(error);
    // Fail closed: a transient DB error must not silently grant access.
    return res.status(500).send(
      new ServerResponse(false, null, "An error occurred while verifying Time Entries access.")
    );
  }
}
