import ProjectsController from "../../controllers/projects-controller";
import { isTeamLead } from "../../shared/team-permissions";
import { NextFunction } from "express";

import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { hasTaskExportPermission } from "../../services/task-export/task-export-access";

/**
 * TE-19: Owner / Admin / Project Manager / Team Lead may export.
 * Reads project id from path `:projectId` (preferred) or `?current_project_id=`.
 * Mirrors project-manager-validator but works for nested project routes without
 * requiring the client to duplicate the id in the query string.
 */
export default async function requireTaskExportAccess(
  req: IWorkLenzRequest,
  res: IWorkLenzResponse,
  next: NextFunction
): Promise<IWorkLenzResponse | void> {
  const projectId =
    (req.params.projectId as string) ||
    (req.query.current_project_id as string) ||
    "";

  if (!projectId) {
    return res
      .status(400)
      .send(new ServerResponse(false, null, "Project id is required"));
  }

  // Keep query in sync for any downstream helpers that expect current_project_id
  req.query.current_project_id = projectId;

  let projectManagerTeamMemberId: string | null = null;
  let isTeamLeadMember = false;

  const managers = await ProjectsController.getProjectManager(projectId);
  if (managers.length) {
    projectManagerTeamMemberId = managers[0].team_member_id || null;
  }

  if (req.user?.id && req.user?.team_id) {
    isTeamLeadMember = await isTeamLead(req.user.id, req.user.team_id);
  }

  if (
    hasTaskExportPermission({
      user: req.user,
      projectManagerTeamMemberId,
      isTeamLeadMember,
    })
  ) {
    return next();
  }

  return res
    .status(401)
    .send(
      new ServerResponse(
        false,
        null,
        "You are not authorized to perform this action"
      )
    );
}
