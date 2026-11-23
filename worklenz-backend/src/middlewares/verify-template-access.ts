import { NextFunction } from "express";
import db from "../config/db";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import { log_error } from "../shared/utils";

const executeTemplateReadAccess = (location: "params" | "body" | "query", fieldName: string) =>
  async (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction) => {
    if (!req.user?.id || !req.user.team_id) {
      return res.status(401).send(new ServerResponse(false, null, "Authentication required"));
    }
    const templateId = req[location]?.[fieldName];
    if (!templateId || typeof templateId !== "string") {
      return res.status(400).send(new ServerResponse(false, null, "Invalid template ID"));
    }
    try {
      const result = await db.query(`
        SELECT 1 FROM custom_project_templates cpt
        JOIN team_members tm ON tm.team_id = $2 AND tm.user_id = $3 AND tm.active IS TRUE
        WHERE cpt.id = $1 AND (cpt.team_id = $2 OR
          (cpt.scope = 'organization' AND in_organization(cpt.team_id, $2)))
        LIMIT 1`, [templateId, req.user.team_id, req.user.id]);
      if (!result.rows.length) return res.status(404).send(new ServerResponse(false, null, "Template not found"));
      return next();
    } catch (error) {
      log_error(error);
      return res.status(500).send(new ServerResponse(false, null, "Unable to verify template access"));
    }
  };

/** Preserve organization-shared template reads while requiring active membership. */
export function verifyTemplateReadAccess(
  location?: "params" | "body" | "query",
  fieldName?: string
): (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction) => Promise<unknown>;
export function verifyTemplateReadAccess(
  req: IWorkLenzRequest,
  res: IWorkLenzResponse,
  next: NextFunction
): Promise<unknown>;
export function verifyTemplateReadAccess(
  reqOrLocation?: IWorkLenzRequest | "params" | "body" | "query",
  resOrField?: IWorkLenzResponse | string,
  maybeNext?: NextFunction
): ((req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction) => Promise<unknown>) | Promise<unknown> {
  if (reqOrLocation && typeof reqOrLocation === "object" && typeof maybeNext === "function") {
    return executeTemplateReadAccess("params", "id")(
      reqOrLocation as IWorkLenzRequest,
      resOrField as IWorkLenzResponse,
      maybeNext
    );
  }
  const location = (reqOrLocation as "params" | "body" | "query") || "params";
  const fieldName = (resOrField as string) || "id";
  return executeTemplateReadAccess(location, fieldName);
}

/** Verify template write access: template must belong to active team and caller cannot be guest. */
export const verifyTemplateWriteAccess = (
  location: "params" | "body" | "query" = "query",
  fieldName: string = "id"
) => async (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction) => {
  if (!req.user?.id || !req.user.team_id) {
    return res.status(401).send(new ServerResponse(false, null, "Authentication required"));
  }
  const templateId = req[location]?.[fieldName];
  if (!templateId || typeof templateId !== "string") {
    return res.status(400).send(new ServerResponse(false, null, "Invalid template ID"));
  }
  try {
    const result = await db.query(`
      SELECT 1 FROM custom_project_templates cpt
      JOIN team_members tm ON tm.team_id = cpt.team_id AND tm.user_id = $2 AND tm.active IS TRUE
      WHERE cpt.id = $1 AND cpt.team_id = $3 AND tm.is_guest IS FALSE
      LIMIT 1`, [templateId, req.user.id, req.user.team_id]);
    if (!result.rows.length) {
      return res.status(403).send(new ServerResponse(false, null, "You do not have permission to modify this template"));
    }
    return next();
  } catch (error) {
    log_error(error);
    return res.status(500).send(new ServerResponse(false, null, "Unable to verify template access"));
  }
};
