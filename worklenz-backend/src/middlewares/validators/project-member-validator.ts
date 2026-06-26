import { NextFunction } from "express";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import ProjectMembersController from "../../controllers/project-members-controller";

export default async function (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): Promise<IWorkLenzResponse | void> {

  const projectId = req.body.project_id;
  const teamMemberId = req.user?.team_member_id;

  // default_view is optional when only updating group_by preferences
  const hasViewPreference = req.body.default_view || req.body.task_list_group_by || req.body.board_group_by;

  if (!projectId || !hasViewPreference || !teamMemberId) {
    return res.status(401).send(new ServerResponse(false, null, "Unknown error has occured"));
  }

  const isProjectMember = await ProjectMembersController.checkIfMemberExists(projectId, teamMemberId as string);

  if (isProjectMember) {
    return next();
  }

  req.body.team_member_id = teamMemberId;
  req.body.user_id = req.user?.id;
  req.body.team_id = req.user?.team_id;
  req.body.access_level = req.body.access_level ? req.body.access_level : "MEMBER";

  const isProjectMemberAssigned = await ProjectMembersController.createOrInviteMembers(req.body);

  if (isProjectMemberAssigned) {
    return next();
  }

  return res.status(401).send(new ServerResponse(false, null, "Cannot assign as Project Member"));

}
