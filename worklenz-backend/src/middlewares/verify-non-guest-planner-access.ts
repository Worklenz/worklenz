import { NextFunction } from "express";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import { log_error } from "../shared/utils";
import { isGuestForActiveTeam } from "../shared/team-permissions";

/**
 * Middleware to block guest team members from the Planner area entirely
 * (Schedule, Timeline, and Workload tabs all share the schedule-gannt /
 * schedule-gannt-v2 routers this is mounted on).
 *
 * Unlike verifyGuestViewAccess (which checks guest status per-project via
 * NON_GUEST_ACCESS_PREDICATE), Planner routes aren't scoped to a single
 * project id, so this checks the team-wide team_members.is_guest flag for
 * the user's active team instead — but still exempts owner/admin roles the
 * same way NON_GUEST_ACCESS_PREDICATE does, since sync_team_member_guest_status()
 * sets is_guest = TRUE for anyone holding a GUEST-level membership on any single
 * project, with no role exception (e.g. an owner added as a guest to one
 * client's project would otherwise be locked out of the whole Planner).
 */
export default async function verifyNonGuestPlannerAccess(
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
        new ServerResponse(false, null, "Guests do not have access to the Planner.")
      );
    }

    return next();
  } catch (error) {
    log_error(error);
    // Fail closed: this middleware's only job is to keep a role out, so a
    // transient DB error must not silently grant access. Mirrors
    // verifyProjectAccess's catch block (500), not the guest-view helpers'.
    return res.status(500).send(
      new ServerResponse(false, null, "An error occurred while verifying Planner access.")
    );
  }
}
