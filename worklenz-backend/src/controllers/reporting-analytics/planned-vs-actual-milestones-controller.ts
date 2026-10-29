import {
  expandAccessibleProjects,
  parseTeamIdsFromInput,
} from "../../shared/analytics-expand-projects";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import WorklenzControllerBase from "../worklenz-controller-base";
import HandleExceptions from "../../decorators/handle-exceptions";
import {
  buildPlannedVsActualMilestonesCsv,
  getPlannedVsActualMilestonesSeries,
  parsePlannedVsActualMilestonesFilters,
} from "../../services/reporting-analytics/planned-vs-actual-milestones.service";

type AnalyticsRequest = IWorkLenzRequest & {
  analyticsAccessibleProjectIds?: string[];
};

export default class PlannedVsActualMilestonesController extends WorklenzControllerBase {
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
    const filters = parsePlannedVsActualMilestonesFilters(
      req.query as Record<string, unknown>,
      accessible,
      teamId
    );

    const data = await getPlannedVsActualMilestonesSeries(filters);
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
    const filters = parsePlannedVsActualMilestonesFilters(body, accessible, teamId);

    const data = await getPlannedVsActualMilestonesSeries(filters);
    const csv = buildPlannedVsActualMilestonesCsv(data);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="planned-vs-actual-milestones.csv"'
    );
    return res.status(200).send(csv);
  }
}
