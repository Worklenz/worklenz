import { NextFunction } from "express";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import db from "../config/db";
import { canViewAnalyticsReports } from "../shared/reporting-analytics-permissions";
import { canViewAllProjects } from "../shared/organization-permissions";
import {
  getEffectiveTeamRole,
  TEAM_ROLE_NAMES,
} from "../shared/team-permissions";
import {
  expandAccessibleProjects,
  parseAccessibleTeamIdsFromInput,
} from "../shared/analytics-expand-projects";

/**
 * Ensures analytics requests only see projects the user can access.
 * Accepts project ids from body.project_ids, query.project_ids, or params.project_id.
 * Attaches req.analyticsAccessibleProjectIds for controllers.
 *
 * Project comparison runs after expanding access across requested team_ids so
 * cross-team org projects are not falsely denied.
 */
export default async function analyticsProjectAccessMiddleware(
  req: IWorkLenzRequest,
  res: IWorkLenzResponse,
  next: NextFunction
): Promise<void> {
  try {
    if (!(await canViewAnalyticsReports(req.user))) {
      res
        .status(403)
        .send(new ServerResponse(false, null, "You are not authorized to access analytics"));
      return;
    }

    const teamId = req.user?.team_id;
    const userId = req.user?.id;
    if (!teamId || !userId) {
      res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
      return;
    }

    const requested = collectRequestedProjectIds(req);
    const input = {
      ...(req.query as Record<string, unknown>),
      ...((req.body as Record<string, unknown> | undefined) ?? {}),
    };
    const requestedTeamIds = await parseAccessibleTeamIdsFromInput(userId, teamId, input);

    // Owner/Admin, Team Lead, or "View all projects" — every team project.
    // Everyone else — only projects they are a member of.
    const role = getEffectiveTeamRole(req.user);
    const seesAllTeamProjects =
      role === TEAM_ROLE_NAMES.OWNER ||
      role === TEAM_ROLE_NAMES.ADMIN ||
      role === TEAM_ROLE_NAMES.TEAM_LEAD ||
      (await canViewAllProjects(req.user));

    const q = seesAllTeamProjects
      ? `
      SELECT p.id
      FROM projects p
      WHERE p.team_id = $1::UUID
    `
      : `
      SELECT p.id
      FROM projects p
      WHERE p.team_id = $1::UUID
        AND EXISTS (
          SELECT 1 FROM project_members pm
          JOIN team_members tm ON tm.id = pm.team_member_id
          WHERE pm.project_id = p.id
            AND tm.user_id = $2::UUID
            AND tm.team_id = $1::UUID
            AND tm.active = TRUE
        )
    `;

    const result = await db.query(q, seesAllTeamProjects ? [teamId] : [teamId, userId]);
    const sessionAccessible = result.rows.map((row: { id: string }) => row.id);
    const accessibleList = await expandAccessibleProjects(
      userId,
      teamId,
      sessionAccessible,
      requestedTeamIds
    );
    const accessible = new Set<string>(accessibleList);

    if (requested.length > 0) {
      // Intersect with accessible set. Select All can include stale/out-of-scope
      // IDs from the filter dropdown — reject only when none remain usable.
      const allowedRequested = requested.filter(id => accessible.has(id));
      if (allowedRequested.length === 0) {
        res
          .status(403)
          .send(new ServerResponse(false, null, "One or more projects are not accessible"));
        return;
      }
      (req as IWorkLenzRequest & { analyticsAccessibleProjectIds?: string[] }).analyticsAccessibleProjectIds =
        allowedRequested;
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
