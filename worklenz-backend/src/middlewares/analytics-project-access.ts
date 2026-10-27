import { NextFunction } from "express";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import db from "../config/db";
import { canViewAnalyticsReports } from "../shared/reporting-analytics-permissions";

/**
 * Ensures analytics requests only see projects the user can access.
 * Accepts project ids from body.project_ids, query.project_ids, or params.project_id.
 * Attaches req.analyticsAccessibleProjectIds for controllers.
 */
export default async function analyticsProjectAccessMiddleware(
  req: IWorkLenzRequest,
  res: IWorkLenzResponse,
  next: NextFunction
): Promise<void> {
  try {
    if (!canViewAnalyticsReports(req.user)) {
      res.status(403).send(new ServerResponse(false, null, "Guests cannot access analytics"));
      return;
    }

    const teamId = req.user?.team_id;
    const userId = req.user?.id;
    if (!teamId || !userId) {
      res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
      return;
    }

    const requested = collectRequestedProjectIds(req);

    const q = `
      SELECT p.id
      FROM projects p
      WHERE p.team_id = $1::UUID
        AND (
          EXISTS (
            SELECT 1 FROM team_members tm
            JOIN roles r ON r.id = tm.role_id
            WHERE tm.user_id = $2::UUID
              AND tm.team_id = $1::UUID
              AND tm.active = TRUE
              AND (r.owner = TRUE OR r.admin_role = TRUE)
          )
          OR EXISTS (
            SELECT 1 FROM project_members pm
            JOIN team_members tm ON tm.id = pm.team_member_id
            WHERE pm.project_id = p.id
              AND tm.user_id = $2::UUID
              AND tm.team_id = $1::UUID
              AND tm.active = TRUE
          )
        )
    `;

    const result = await db.query(q, [teamId, userId]);
    const accessible = new Set<string>(result.rows.map((row: { id: string }) => row.id));

    if (requested.length > 0) {
      const denied = requested.filter(id => !accessible.has(id));
      if (denied.length > 0) {
        res
          .status(403)
          .send(new ServerResponse(false, null, "One or more projects are not accessible"));
        return;
      }
      (req as IWorkLenzRequest & { analyticsAccessibleProjectIds?: string[] }).analyticsAccessibleProjectIds =
        requested;
    } else {
      (req as IWorkLenzRequest & { analyticsAccessibleProjectIds?: string[] }).analyticsAccessibleProjectIds =
        [...accessible];
    }

    next();
  } catch (error) {
    next(error);
  }
}

function collectRequestedProjectIds(req: IWorkLenzRequest): string[] {
  const ids = new Set<string>();

  const fromParam = req.params?.project_id;
  if (typeof fromParam === "string" && fromParam) ids.add(fromParam);

  const fromQuery = req.query?.project_ids;
  if (typeof fromQuery === "string" && fromQuery) {
    fromQuery.split(",").forEach(id => id.trim() && ids.add(id.trim()));
  } else if (Array.isArray(fromQuery)) {
    fromQuery.forEach(v => typeof v === "string" && v && ids.add(v));
  }

  const fromBody = (req.body as { project_ids?: unknown } | undefined)?.project_ids;
  if (Array.isArray(fromBody)) {
    fromBody.forEach(v => typeof v === "string" && v && ids.add(v));
  }

  return [...ids];
}
