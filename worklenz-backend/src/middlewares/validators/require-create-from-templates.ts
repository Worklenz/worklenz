import { NextFunction } from "express";

import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { hasTeamAdminPrivileges } from "../../shared/team-permissions";
import {
  enrichSessionWithTemplateCreateAccess,
  userCanCreateProjectsFromTemplates,
} from "../../shared/template-create-access";

/**
 * Gate create-from-template routes to Owner/Admin users.
 */
const requireCreateFromTemplates = async (
  req: IWorkLenzRequest,
  res: IWorkLenzResponse,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    return;
  }

  // Keep the legacy session flag in sync without granting member access.
  if (!hasTeamAdminPrivileges(req.user)) {
    await enrichSessionWithTemplateCreateAccess(req.user);
  }

  if (!userCanCreateProjectsFromTemplates(req.user)) {
    res
      .status(403)
      .send(
        new ServerResponse(
          false,
          null,
          "You do not have permission to create projects from templates."
        )
      );
    return;
  }

  next();
};

export default requireCreateFromTemplates;
