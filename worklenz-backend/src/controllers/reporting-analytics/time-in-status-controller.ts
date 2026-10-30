import moment from "moment";

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
  buildTimeInStatusCsv,
  getTimeInStatusFilterOptions,
  getTimeInStatusSeries,
  parseTimeInStatusFilters,
} from "../../services/reporting-analytics/time-in-status.service";

type AnalyticsRequest = IWorkLenzRequest & {
  analyticsAccessibleProjectIds?: string[];
};

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
      await parseAccessibleTeamIdsFromInput(userId, teamId, query)
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
      await parseAccessibleTeamIdsFromInput(userId, teamId, query)
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
      await parseAccessibleTeamIdsFromInput(userId, teamId, merged)
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
