import {
  expandAccessibleProjects,
  parseAccessibleTeamIdsFromInput,
} from "../../shared/analytics-expand-projects";
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
    const teamIds = await parseAccessibleTeamIdsFromInput(userId, teamId, req.query as Record<string, unknown>);
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
    const teamIds = await parseAccessibleTeamIdsFromInput(userId, teamId, body);
    const accessible = await expandAccessibleProjects(userId, teamId, baseIds, teamIds);
    const filters = parseTimeReportFilters(body, accessible, teamId);

    const data = await getTimeReportSeries(filters);
    const csv = buildTimeReportCsv(data);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="time-report.csv"');
    return res.status(200).send(csv);
  }
}
