import moment from "moment";

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
  buildCfdCsvMatrix,
  getCfdSeries,
  parseCfdFilters,
} from "../../services/reporting-analytics/cfd-series.service";

type AnalyticsRequest = IWorkLenzRequest & {
  analyticsAccessibleProjectIds?: string[];
};

export default class CfdController extends WorklenzControllerBase {
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
    const filters = parseCfdFilters(query, accessible, teamId);
    const data = await getCfdSeries(filters);
    return res.status(200).send(new ServerResponse(true, data));
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
    const base =
      (req as AnalyticsRequest).analyticsAccessibleProjectIds ?? [];
    const accessible = await expandAccessibleProjects(
      userId,
      teamId,
      base,
      parseTeamIdsFromInput(merged)
    );
    const filters = parseCfdFilters(merged, accessible, teamId);
    const data = await getCfdSeries(filters);
    const csv = buildCfdCsvMatrix(data);

    const exportDate = moment().format("YYYY-MM-DD");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=cfd-matrix-${exportDate}.csv`
    );
    res.status(200).send(csv);
  }
}
