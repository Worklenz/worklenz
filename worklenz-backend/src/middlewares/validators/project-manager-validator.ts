import {NextFunction} from "express";

import {IWorkLenzRequest} from "../../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../../interfaces/worklenz-response";
import {ServerResponse} from "../../models/server-response";
import ProjectsController from "../../controllers/projects-controller";

export default async function (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): Promise<IWorkLenzResponse | void> {

  let is_project_manager = false;

  if (req.query.current_project_id) {
    const result = await ProjectsController.getProjectManager(req.query.current_project_id as string);
    if (result.length)
      if (req.user && (result[0].team_member_id === req.user?.team_member_id)) is_project_manager = true;
  }

  if (req.user && (req.user.owner || req.user.is_admin || is_project_manager))
    return next();
  return res.status(401).send(new ServerResponse(false, null, "You are not authorized to perform this action"));
}

