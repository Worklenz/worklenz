import { NextFunction } from "express";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { getManagedMembers } from "../../shared/team-permissions";

export default async function teamLeadMemberScopeValidator(
  req: IWorkLenzRequest,
  res: IWorkLenzResponse,
  next: NextFunction
): Promise<IWorkLenzResponse | void> {
  const userId = req.user?.id;
  const teamId = req.user?.team_id;
  const teamMemberId = req.user?.team_member_id;

  if (!userId || !teamId || !teamMemberId) {
    return res.status(400).send(new ServerResponse(false, null, "Missing user context"));
  }

  // Admins and owners have full access (no scope restriction)
  if (req.user?.owner || req.user?.is_admin) {
    req.memberScope = { memberIds: [] }; // Empty array means no restriction
    return next();
  }

  // For team leads, get their managed members
  const managedMembers = await getManagedMembers(teamMemberId);
  req.memberScope = { memberIds: managedMembers };
  return next();
}
