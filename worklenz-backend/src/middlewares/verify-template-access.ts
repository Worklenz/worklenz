import { NextFunction } from "express";
import db from "../config/db";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import { log_error } from "../shared/utils";

/** Preserve organization-shared template reads while requiring active membership. */
export const verifyTemplateReadAccess = async (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction) => {
  if (!req.user?.id || !req.user.team_id) {
    return res.status(401).send(new ServerResponse(false, null, "Authentication required"));
  }
  try {
    const result = await db.query(`
      SELECT 1 FROM custom_project_templates cpt
      JOIN team_members tm ON tm.team_id = $2 AND tm.user_id = $3 AND tm.active IS TRUE
      WHERE cpt.id = $1 AND (cpt.team_id = $2 OR
        (cpt.scope = 'organization' AND in_organization(cpt.team_id, $2)))
      LIMIT 1`, [req.params.id, req.user.team_id, req.user.id]);
    if (!result.rows.length) return res.status(404).send(new ServerResponse(false, null, "Template not found"));
    return next();
  } catch (error) {
    log_error(error);
    return res.status(500).send(new ServerResponse(false, null, "Unable to verify template access"));
  }
};
