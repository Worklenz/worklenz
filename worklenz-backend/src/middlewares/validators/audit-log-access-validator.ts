import { NextFunction } from "express";

import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { getEffectiveTeamRole, TEAM_ROLE_NAMES } from "../../shared/team-permissions";

/**
 * Access guard for the Audit Log read API (Audit log spec, task 4.4 + spike 0.7:
 * "Confirm Owner/Admin-only (no Team Lead scope)").
 *
 * This mirrors the same Owner/Admin role check as
 * middlewares/validators/team-owner-or-admin-validator.ts (used by every other
 * /admin-center/organization/* route), but responds 403 instead of 401 - the business spec
 * for this feature explicitly calls for "403 otherwise", so this is a dedicated validator
 * rather than a change to the shared one (which the rest of Admin Center already depends on
 * returning 401).
 */
export default function (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): IWorkLenzResponse | void {
  const currentRole = getEffectiveTeamRole(req.user);

  if (
    req.user &&
    (currentRole === TEAM_ROLE_NAMES.OWNER || currentRole === TEAM_ROLE_NAMES.ADMIN)
  )
    return next();

  return res.status(403).send(new ServerResponse(false, null, "You are not authorized to view the audit log"));
}

/**
 * Owner-only guard for changing Audit Log retention (Audit log spec, task 6.1). Same 403
 * contract as the default export above; Admins can view the log but not shorten its history.
 */
export function auditLogOwnerValidator(req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): IWorkLenzResponse | void {
  if (req.user && getEffectiveTeamRole(req.user) === TEAM_ROLE_NAMES.OWNER)
    return next();

  return res.status(403).send(new ServerResponse(false, null, "Only the workspace owner can change audit log retention"));
}
