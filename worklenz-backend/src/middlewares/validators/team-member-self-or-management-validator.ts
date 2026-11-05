import { NextFunction } from "express";

import db from "../../config/db";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { hasTeamMemberManagementAccess } from "../../shared/organization-permissions";
import { canManageTeamMemberViaProjectPermission } from "../../shared/project-access";
import { isSelfTeamMember } from "../../shared/team-permissions";
import { isValidUuid } from "../../shared/validation-helpers";

const resolveProjectId = (req: IWorkLenzRequest): string | undefined => {
  const fromQuery = req.query?.project_id ?? req.query?.current_project_id;
  const fromBody = req.body?.project_id;
  const value = (fromQuery ?? fromBody) as string | undefined;
  return value && isValidUuid(value) ? value : undefined;
};

export default async function teamMemberSelfOrManagementValidator(
  req: IWorkLenzRequest,
  res: IWorkLenzResponse,
  next: NextFunction,
): Promise<IWorkLenzResponse | void> {
  if (!req.user) {
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

  // Owner or Admin can manage all team members
  if (canManageTeamMembers(req.user)) {
    return next();
  }

  const targetMemberId = req.params.id;

  // Project "Manage members" — edit profile of someone on that project
  try {
    const projectId = resolveProjectId(req);
    if (
      targetMemberId &&
      (await canManageTeamMemberViaProjectPermission(req.user, projectId, targetMemberId))
    ) {
      return next();
    }
  } catch (error) {
    return next(error);
  }

  // Authenticated self-read or self-update by session team_member_id
  if (isSelfTeamMember(req.user, targetMemberId)) {
    return next();
  }

  // Fallback: If session team_member_id is not directly populated, check DB by user_id
  if (targetMemberId && isValidUuid(targetMemberId) && req.user.id && req.user.team_id) {
    try {
      const q = `
        SELECT 1
        FROM team_members
        WHERE id = $1::UUID
          AND user_id = $2::UUID
          AND team_id = $3::UUID;
      `;
      const result = await db.query(q, [targetMemberId, req.user.id, req.user.team_id]);
      if (result.rows.length > 0) {
        return next();
      }
    } catch {
      // Fall through to 401
    }
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
