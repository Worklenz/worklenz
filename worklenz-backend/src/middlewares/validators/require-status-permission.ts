import { NextFunction } from "express";

import db from "../../config/db";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { getProjectAccessForRequest } from "../../shared/project-access";
import { log_error } from "../../shared/utils";
import { hasProjectPermission } from "./require-project-permission";

/** Authorize a status mutation against the project that owns the status. */
const requireStatusPermission = async (
  req: IWorkLenzRequest,
  res: IWorkLenzResponse,
  next: NextFunction
): Promise<IWorkLenzResponse | void> => {
  try {
    const statusId = req.params.id;
    const result = await db.query(
      "SELECT project_id FROM task_statuses WHERE id = $1::UUID LIMIT 1",
      [statusId]
    );
    const projectId = result.rows[0]?.project_id as string | undefined;

    if (!projectId) {
      return res.status(404).send(new ServerResponse(false, null, "Status not found"));
    }

    const access = await getProjectAccessForRequest(req, projectId);
    if (!hasProjectPermission(access.permissions, "statuses")) {
      return res
        .status(403)
        .send(new ServerResponse(false, null, "You are not authorized to perform this action"));
    }

    req.query.current_project_id = projectId;
    req.query.project = projectId;
    req.body.project_id = projectId;
    return next();
  } catch (error) {
    log_error(error);
    return res.status(500).send(new ServerResponse(false, null, "Failed to verify permission"));
  }
};

export default requireStatusPermission;
