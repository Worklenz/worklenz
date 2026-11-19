import { NextFunction } from "express";
import db from "../config/db";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import { log_error } from "../shared/utils";

interface ReportingScopeOptions {
  resource: "team" | "project" | "member";
  location: "params" | "query";
  field: string;
  optional?: boolean;
}

const TARGET_TEAM_QUERY: Record<ReportingScopeOptions["resource"], string> = {
  team: "SELECT id AS team_id FROM teams WHERE id = $1::uuid",
  project: "SELECT team_id FROM projects WHERE id = $1::uuid",
  member: "SELECT team_id FROM team_members WHERE id = $1::uuid",
};

/** Authorize report targets against the active team owner's organization. */
export const verifyReportingScope = ({ resource, location, field, optional = false }: ReportingScopeOptions) =>
  async (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction) => {
    const value = req[location]?.[field];
    if ((value === undefined || value === "") && optional) return next();
    if (!req.user?.id || !req.user.team_id) return res.status(401).send(new ServerResponse(false, null, "Authentication required"));
    if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid report scope"));
    }
    try {
      const result = await db.query(`
        SELECT 1 FROM (${TARGET_TEAM_QUERY[resource]}) target
        JOIN teams target_team ON target_team.id = target.team_id
        JOIN teams active_team ON active_team.id = $2::uuid AND active_team.user_id = target_team.user_id
        JOIN team_members tm ON tm.team_id = active_team.id AND tm.user_id = $3::uuid AND tm.active IS TRUE
        LIMIT 1`, [value, req.user.team_id, req.user.id]);
      if (!result.rows.length) return res.status(403).send(new ServerResponse(false, null, "Report scope is not accessible"));
      return next();
    } catch (error) {
      log_error(error);
      return res.status(500).send(new ServerResponse(false, null, "Unable to verify report access"));
    }
  };
