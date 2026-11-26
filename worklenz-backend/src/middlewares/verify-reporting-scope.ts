import { NextFunction } from "express";
import db from "../config/db";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import { log_error } from "../shared/utils";

export interface ReportingScopeOptions {
  resource: "team" | "project" | "member";
  location: "params" | "query" | "body";
  field: string;
  optional?: boolean;
  isArray?: boolean;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TARGET_TEAM_QUERY: Record<ReportingScopeOptions["resource"], string> = {
  team: "SELECT id AS team_id FROM teams WHERE id = $1::uuid",
  project: "SELECT team_id FROM projects WHERE id = $1::uuid",
  member: "SELECT team_id FROM team_members WHERE id = $1::uuid",
};

const TARGET_TEAM_ARRAY_QUERY: Record<ReportingScopeOptions["resource"], string> = {
  team: "SELECT id, id AS team_id FROM teams WHERE id = ANY($1::uuid[])",
  project: "SELECT id, team_id FROM projects WHERE id = ANY($1::uuid[])",
  member: "SELECT id, team_id FROM team_members WHERE id = ANY($1::uuid[])",
};

/** Authorize report targets against the active team owner's organization. */
export const verifyReportingScope = ({ resource, location, field, optional = false, isArray = false }: ReportingScopeOptions) =>
  async (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction) => {
    const raw = (field === "" || field === undefined) ? req[location] : req[location]?.[field];

    if (!req.user?.id || !req.user.team_id) {
      return res.status(401).send(new ServerResponse(false, null, "Authentication required"));
    }

    if (isArray) {
      if ((raw === undefined || raw === null || raw === "") && optional) return next();
      if (Array.isArray(raw) && raw.length === 0 && optional) return next();

      let items: string[] = [];
      if (Array.isArray(raw)) {
        items = raw.map(x => (typeof x === "string" ? x.trim() : "")).filter(Boolean);
      } else if (typeof raw === "string") {
        items = raw.split(",").map(s => s.trim()).filter(Boolean);
      } else {
        return res.status(400).send(new ServerResponse(false, null, "Invalid report scope"));
      }

      if (items.length === 0) {
        if (optional) return next();
        return res.status(400).send(new ServerResponse(false, null, "Invalid report scope"));
      }

      for (const item of items) {
        if (!UUID_REGEX.test(item)) {
          return res.status(400).send(new ServerResponse(false, null, "Invalid report scope"));
        }
      }

      const uniqueIds = Array.from(new Set(items));

      try {
        const result = await db.query(`
          SELECT count(DISTINCT target.id)::int AS count
          FROM (${TARGET_TEAM_ARRAY_QUERY[resource]}) target
          JOIN teams target_team ON target_team.id = target.team_id
          JOIN teams active_team ON active_team.id = $2::uuid AND active_team.user_id = target_team.user_id
          JOIN team_members tm ON tm.team_id = active_team.id AND tm.user_id = $3::uuid AND tm.active IS TRUE
        `, [uniqueIds, req.user.team_id, req.user.id]);

        const authorizedCount = result.rows[0]?.count ?? 0;
        if (authorizedCount !== uniqueIds.length) {
          return res.status(403).send(new ServerResponse(false, null, "Report scope is not accessible"));
        }
        return next();
      } catch (error) {
        log_error(error);
        return res.status(500).send(new ServerResponse(false, null, "Unable to verify report access"));
      }
    }

    // Single item handling (existing behavior)
    if ((raw === undefined || raw === "") && optional) return next();
    if (typeof raw !== "string" || !UUID_REGEX.test(raw)) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid report scope"));
    }
    try {
      const result = await db.query(`
        SELECT 1 FROM (${TARGET_TEAM_QUERY[resource]}) target
        JOIN teams target_team ON target_team.id = target.team_id
        JOIN teams active_team ON active_team.id = $2::uuid AND active_team.user_id = target_team.user_id
        JOIN team_members tm ON tm.team_id = active_team.id AND tm.user_id = $3::uuid AND tm.active IS TRUE
        LIMIT 1`, [raw, req.user.team_id, req.user.id]);
      if (!result.rows.length) return res.status(403).send(new ServerResponse(false, null, "Report scope is not accessible"));
      return next();
    } catch (error) {
      log_error(error);
      return res.status(500).send(new ServerResponse(false, null, "Unable to verify report access"));
    }
  };
