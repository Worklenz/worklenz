import { NextFunction } from "express";

import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { userCanCreateProjectsFromTemplatesAsync } from "../../shared/template-create-access";

/**
 * Gate create-from-template routes to users with "Create projects"
 * (Owners always hold it via the organization permission helper).
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

  try {
    const canCreate = await userCanCreateProjectsFromTemplatesAsync(req.user);
    req.user.can_create_projects_from_templates = canCreate;

    if (!canCreate) {
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
  } catch (error) {
    next(error);
  }
};

export default requireCreateFromTemplates;
