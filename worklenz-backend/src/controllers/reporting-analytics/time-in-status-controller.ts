import moment from "moment";

import db from "../../config/db";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import WorklenzControllerBase from "../worklenz-controller-base";
import HandleExceptions from "../../decorators/handle-exceptions";
import {
  buildTimeInStatusCsv,
  getTimeInStatusFilterOptions,
  getTimeInStatusSeries,
  parseTimeInStatusFilters,
} from "../../services/reporting-analytics/time-in-status.service";

type AnalyticsRequest = IWorkLenzRequest & {
  analyticsAccessibleProjectIds?: string[];
};

async function expandAccessibleProjects(
  userId: string,
  sessionTeamId: string,
  baseProjectIds: string[],
  requestedTeamIds: string[]
): Promise<string[]> {
  const teamIds = [...new Set([sessionTeamId, ...requestedTeamIds.filter(Boolean)])];
  if (teamIds.length <= 1) return baseProjectIds;

  const result = await db.query(
    `SELECT DISTINCT p.id
     FROM projects p
     WHERE p.team_id = ANY($1::UUID[])
       AND (
         EXISTS (
           SELECT 1 FROM team_members tm
           JOIN roles r ON r.id = tm.role_id
           WHERE tm.user_id = $2::UUID
             AND tm.team_id = p.team_id
             AND tm.active = TRUE
             AND (r.owner = TRUE OR r.admin_role = TRUE)
         )
         OR EXISTS (
           SELECT 1 FROM project_members pm
           JOIN team_members tm ON tm.id = pm.team_member_id
           WHERE pm.project_id = p.id
             AND tm.user_id = $2::UUID
             AND tm.team_id = p.team_id
             AND tm.active = TRUE
         )
       )`,
    [teamIds, userId]
  );

  return result.rows.map((row: { id: string }) => row.id);
}

function parseTeamIdsFromInput(input: Record<string, unknown>): string[] {
  const raw = input.team_ids;
  if (Array.isArray(raw)) {
    return raw.filter((v): v is string => typeof v === "string" && !!v);
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw
      .split(/[,\s]+/)
      .map(s => s.trim())
      .filter(Boolean);
  }
  return [];
}

export default class TimeInStatusController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async getSeries(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const userId = req.user?.id;
    if (!teamId || !userId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const query = req.query as Record<string, unknown>;
    const base =
      (req as AnalyticsRequest).analyticsAccessibleProjectIds ?? [];
    const accessible = await expandAccessibleProjects(
      userId,
      teamId,
      base,
      parseTeamIdsFromInput(query)
    );
    const filters = parseTimeInStatusFilters(query, accessible, teamId);
    const data = await getTimeInStatusSeries(filters);
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async getFilterOptions(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const userId = req.user?.id;
    if (!teamId || !userId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const query = req.query as Record<string, unknown>;
    const base =
      (req as AnalyticsRequest).analyticsAccessibleProjectIds ?? [];
    const accessible = await expandAccessibleProjects(
      userId,
      teamId,
      base,
      parseTeamIdsFromInput(query)
    );
    const filters = parseTimeInStatusFilters(query, accessible, teamId);
    const options = await getTimeInStatusFilterOptions(filters.projectIds);
    return res.status(200).send(new ServerResponse(true, options));
  }

  @HandleExceptions()
  public static async exportCsv(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<void> {
    const teamId = req.user?.team_id;
    const userId = req.user?.id;
    if (!teamId || !userId) {
      res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const merged = { ...body, ...((body.filters as object) ?? {}) };
    // CSV exports need the full per-issue width — raise limit.
    if (!merged.limit) merged.limit = 2000;

    const base =
      (req as AnalyticsRequest).analyticsAccessibleProjectIds ?? [];
    const accessible = await expandAccessibleProjects(
      userId,
      teamId,
      base,
      parseTeamIdsFromInput(merged)
    );
    const filters = parseTimeInStatusFilters(merged, accessible, teamId);
    const data = await getTimeInStatusSeries(filters);
    const csv = buildTimeInStatusCsv(data);

    const exportDate = moment().format("YYYY-MM-DD");
    const suffix = filters.viewMode === "per_issue" ? "issues" : "aggregate";
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=time-in-status-${suffix}-${exportDate}.csv`
    );
    res.status(200).send(csv);
  }
}
