import { NextFunction } from "express";

import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { hasTeamMemberManagementAccess } from "../../shared/organization-permissions";

export default async function teamRoleManagementValidator(
  req: IWorkLenzRequest,
  res: IWorkLenzResponse,
  next: NextFunction,
): Promise<IWorkLenzResponse | void> {
  try {
    if (req.user && (await hasTeamMemberManagementAccess(req.user))) {
      return next();
    }

    return res
      .status(403)
      .send(
        new ServerResponse(
          false,
          null,
          "You are not authorized to perform this action",
        ),
      );
  } catch (error) {
    return next(error);
  }
}
