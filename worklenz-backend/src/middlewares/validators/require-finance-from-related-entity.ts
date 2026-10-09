import { NextFunction } from "express";

import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import db from "../../config/db";
import { log_error } from "../../shared/utils";
import { getProjectAccessForRequest } from "../../shared/project-access";
import { hasProjectPermission } from "./require-project-permission";

/**
 * Resolve project id from a task / rate-card route, then require finance permission.
 */
export default function requireFinanceFromRelatedEntity(
  kind: "task" | "task_param" | "rate_card_role"
) {
  return async (
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
    next: NextFunction
  ): Promise<IWorkLenzResponse | void> => {
    try {
      let projectId: string | null = null;

      if (kind === "task") {
        const taskId = req.params.task_id || req.params.id;
        if (taskId) {
          const result = await db.query(
            `SELECT project_id FROM tasks WHERE id = $1::UUID LIMIT 1`,
            [taskId]
          );
          projectId = result.rows[0]?.project_id || null;
        }
      }

      if (kind === "task_param") {
        const taskId = req.params.id;
        if (taskId) {
          const result = await db.query(
            `SELECT project_id FROM tasks WHERE id = $1::UUID LIMIT 1`,
            [taskId]
          );
          projectId = result.rows[0]?.project_id || null;
        }
      }

      if (kind === "rate_card_role") {
        const roleId = req.params.rate_card_role_id || req.params.id;
        if (roleId) {
          const result = await db.query(
            `SELECT project_id FROM finance_project_rate_card_roles WHERE id = $1::UUID LIMIT 1`,
            [roleId]
          );
          projectId = result.rows[0]?.project_id || null;
        }
      }

      projectId =
        projectId ||
        (req.params.project_id as string) ||
        (req.body?.project_id as string) ||
        (req.query.current_project_id as string) ||
        null;

      if (!projectId) {
        return res
          .status(400)
          .send(new ServerResponse(false, null, "Project id is required"));
      }

      req.query.current_project_id = projectId;
      const access = await getProjectAccessForRequest(req, projectId);
      if (!hasProjectPermission(access.permissions, "finance")) {
        return res
          .status(403)
          .send(
            new ServerResponse(
              false,
              null,
              "You are not authorized to access project finance"
            )
          );
      }
      return next();
    } catch (error) {
      log_error(error);
      return res
        .status(500)
        .send(new ServerResponse(false, null, "Failed to verify finance access"));
    }
  };
}
