import { NextFunction } from "express";

import db from "../../config/db";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { getProjectAccessForRequest } from "../../shared/project-access";
import { TEAM_ROLE_NAMES } from "../../shared/team-permissions";

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Read-only Client's team access for the project Members tab.
 * Owners/Admins/Team Leads/PMs always; ordinary project members only when
 * projects.members_can_view_client_team is enabled.
 *
 * Mounted ahead of the portal Owner/Admin guard so eligible members can call
 * GET /portal/v2/projects/:projectId/access without opening other admin routes.
 */
export default async function canViewClientTeamValidator(
  req: IWorkLenzRequest,
  res: IWorkLenzResponse,
  next: NextFunction
): Promise<IWorkLenzResponse | void> {
  const projectId = req.params.projectId;
  if (typeof projectId !== "string" || !UUID_SHAPE.test(projectId)) {
    return res.status(400).send(new ServerResponse(false, null, "Invalid projectId"));
  }

  if (!req.user?.id || !req.user.team_id) {
    return res.status(401).send(new ServerResponse(false, null, "Authentication required"));
  }

  const access = await getProjectAccessForRequest(req, projectId);
  if (!access.isProjectMember) {
    return res
      .status(403)
      .send(new ServerResponse(false, null, "You are not authorized to perform this action"));
  }

  const isPrivileged =
    access.teamRole === TEAM_ROLE_NAMES.OWNER ||
    access.teamRole === TEAM_ROLE_NAMES.ADMIN ||
    access.teamRole === TEAM_ROLE_NAMES.TEAM_LEAD ||
    access.isProjectManager;

  if (isPrivileged) {
    return next();
  }

  const setting = await db.query(
    `
      SELECT members_can_view_client_team
      FROM projects
      WHERE id = $1::UUID
        AND team_id = $2::UUID
      LIMIT 1
    `,
    [projectId, req.user.team_id]
  );

  if (!setting.rows[0]?.members_can_view_client_team) {
    return res
      .status(403)
      .send(new ServerResponse(false, null, "You are not authorized to perform this action"));
  }

  return next();
}
