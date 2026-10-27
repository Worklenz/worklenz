import db from "../../config/db";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import WorklenzControllerBase from "../worklenz-controller-base";
import HandleExceptions from "../../decorators/handle-exceptions";
import {
  buildTimeReportCsv,
  getTimeReportSeries,
  parseTimeReportFilters,
} from "../../services/reporting-analytics/time-report.service";

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

export default class TimeReportController extends WorklenzControllerBase {
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

    const analyticsReq = req as AnalyticsRequest;
    const baseIds = analyticsReq.analyticsAccessibleProjectIds ?? [];
    const teamIds = parseTeamIdsFromInput(req.query as Record<string, unknown>);
    const accessible = await expandAccessibleProjects(userId, teamId, baseIds, teamIds);
    const filters = parseTimeReportFilters(
      req.query as Record<string, unknown>,
      accessible,
      teamId
    );

    const data = await getTimeReportSeries(filters);
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async exportCsv(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const userId = req.user?.id;
    if (!teamId || !userId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const analyticsReq = req as AnalyticsRequest;
    const baseIds = analyticsReq.analyticsAccessibleProjectIds ?? [];
    const teamIds = parseTeamIdsFromInput(body);
    const accessible = await expandAccessibleProjects(userId, teamId, baseIds, teamIds);
    const filters = parseTimeReportFilters(body, accessible, teamId);

    const data = await getTimeReportSeries(filters);
    const csv = buildTimeReportCsv(data);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="time-report.csv"');
    return res.status(200).send(csv);
  }
}
