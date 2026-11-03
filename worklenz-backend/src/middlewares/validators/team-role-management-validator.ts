import { NextFunction } from "express";

import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { canManageTeamMembers } from "../../shared/team-permissions";

export default function teamRoleManagementValidator(
  req: IWorkLenzRequest,
  res: IWorkLenzResponse,
  next: NextFunction,
): IWorkLenzResponse | void {
  if (req.user && canManageTeamMembers(req.user)) {
    return next();
  }

  return res
    .status(401)
    .send(
      new ServerResponse(
        false,
        null,
        "You are not authorized to perform this action",
      ),
    );
}
