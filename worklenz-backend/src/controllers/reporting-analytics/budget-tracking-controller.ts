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
  buildBudgetTrackingCsv,
  getBudgetTrackingSeries,
  parseBudgetTrackingFilters,
} from "../../services/reporting-analytics/budget-tracking.service";

type AnalyticsRequest = IWorkLenzRequest & {
  analyticsAccessibleProjectIds?: string[];
};

export default class BudgetTrackingController extends WorklenzControllerBase {
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
    const filters = parseBudgetTrackingFilters(
      req.query as Record<string, unknown>,
      accessible,
      teamId
    );

    const data = await getBudgetTrackingSeries(filters);
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
    const filters = parseBudgetTrackingFilters(body, accessible, teamId);

    const data = await getBudgetTrackingSeries(filters);
    const csv = buildBudgetTrackingCsv(data);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="budget-tracking.csv"'
    );
    return res.status(200).send(csv);
  }
}
