import { NextFunction } from "express";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import { log_error } from "../shared/utils";
import { canViewAllProjects, hasOrganizationPermission, ORGANIZATION_PERMISSIONS } from "../shared/organization-permissions";
import { listGuestVisibleProjectIds } from "../shared/planner-project-visibility";
import { getVisibleProjectIds } from "../shared/project-role-permissions";
import { isGuestForActiveTeam } from "../shared/team-permissions";

/**
 * Middleware for guest access to the Planner area
 * (Schedule, Timeline, and Workload tabs all share the schedule-gannt /
 * schedule-gannt-v2 routers this is mounted on). Guests pass only when the
 * default scheme grants them "View planner".
 *
 * Unlike verifyGuestViewAccess (which checks guest status per-project via
 * NON_GUEST_ACCESS_PREDICATE), Planner routes aren't scoped to a single
 * project id, so this checks the team-wide team_members.is_guest flag for
 * the user's active team instead — but still exempts owner/admin roles the
 * same way NON_GUEST_ACCESS_PREDICATE does, since sync_team_member_guest_status()
 * sets is_guest = TRUE for anyone holding a GUEST-level membership on any single
 * project, with no role exception (e.g. an owner added as a guest to one
 * client's project would otherwise be locked out of the whole Planner).
 *
 * A guest who holds "View planner" is allowed through. Routes that return
 * team-wide project data still limit that guest to projects they belong to,
 * unless they also hold "View all projects" (req.plannerVisibleProjectIds).
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
      const canViewPlanner = await hasOrganizationPermission(
        req.user,
        ORGANIZATION_PERMISSIONS.VIEW_PLANNER
      );
      if (!canViewPlanner) {
        return res.status(403).send(
          new ServerResponse(false, null, "Guests do not have access to the Planner.")
        );
      }

      if (!(await canViewAllProjects(req.user))) {
        req.plannerVisibleProjectIds = await listGuestVisibleProjectIds(userId, teamId);
      }
    }

    const schemeVisible = new Set(await getVisibleProjectIds(userId, teamId));
    req.plannerVisibleProjectIds = (req.plannerVisibleProjectIds ?? [...schemeVisible])
      .filter(id => schemeVisible.has(id));

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
