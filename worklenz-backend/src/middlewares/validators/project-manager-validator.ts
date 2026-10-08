import { NextFunction } from "express";

import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { getProjectAccessForRequest } from "../../shared/project-access";
import {
  getEffectiveTeamRole,
  TEAM_ROLE_NAMES,
} from "../../shared/team-permissions";
import {
  hasProjectPermission,
  resolveRequestProjectId,
  ProjectIdSource,
} from "./require-project-permission";

/**
 * Legacy project-manager gate — now backed by getProjectAccess when a project
 * id is present. Without a project id, Owner / Admin / Team Lead may proceed
 * (e.g. create client from team settings).
 *
 * Prefer requireProjectPermission() for new project-scoped routes.
 */
export default async function projectManagerValidator(
  req: IWorkLenzRequest,
  res: IWorkLenzResponse,
  next: NextFunction
): Promise<IWorkLenzResponse | void> {
  const sources: ProjectIdSource[] = [
    "query.current_project_id",
    "body.project_id",
    "params.projectId",
    "params.project_id",
    "params.id",
    "query.project_id",
  ];

  const projectId = resolveRequestProjectId(req, sources);

  if (!projectId) {
    const role = getEffectiveTeamRole(req.user);
    if (
      role === TEAM_ROLE_NAMES.OWNER ||
      role === TEAM_ROLE_NAMES.ADMIN ||
      role === TEAM_ROLE_NAMES.TEAM_LEAD
    ) {
      return next();
    }
    return res
      .status(403)
      .send(
        new ServerResponse(false, null, "You are not authorized to perform this action")
      );
  }

  if (!req.query.current_project_id) {
    req.query.current_project_id = projectId;
  }

  const access = await getProjectAccessForRequest(req, projectId);
  const allowed =
    hasProjectPermission(access.permissions, "settings") ||
    hasProjectPermission(access.permissions, "statuses") ||
    hasProjectPermission(access.permissions, "phases") ||
    hasProjectPermission(access.permissions, "members.add") ||
    hasProjectPermission(access.permissions, "finance");

  if (allowed) {
    return next();
  }

  return res
    .status(403)
    .send(
      new ServerResponse(false, null, "You are not authorized to perform this action")
    );
}
