import moment from "moment";
import { InvalidCfdDateRangeError } from "../../services/reporting-analytics/cfd-date-range";

import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import WorklenzControllerBase from "../worklenz-controller-base";
import HandleExceptions from "../../decorators/handle-exceptions";
import {
  buildCfdCsvMatrix,
  CfdSeriesFilters,
  getCfdSeries,
  parseCfdFilters,
} from "../../services/reporting-analytics/cfd-series.service";

type AnalyticsRequest = IWorkLenzRequest & {
  analyticsAccessibleProjectIds?: string[];
};

/** Trust middleware-resolved project scope; do not re-expand (overwrites project filters). */
function accessibleProjectIds(req: IWorkLenzRequest): string[] {
  return (req as AnalyticsRequest).analyticsAccessibleProjectIds ?? [];
}

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
    const accessible = accessibleProjectIds(req);
    let filters: CfdSeriesFilters;
    try {
      filters = parseCfdFilters(query, accessible, teamId);
    } catch (error) {
      if (error instanceof InvalidCfdDateRangeError) {
        return res.status(400).send(new ServerResponse(false, null, error.message));
      }
      throw error;
    }
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
    const accessible = accessibleProjectIds(req);
    let filters: CfdSeriesFilters;
    try {
      filters = parseCfdFilters(merged, accessible, teamId);
    } catch (error) {
      if (error instanceof InvalidCfdDateRangeError) {
        res.status(400).send(new ServerResponse(false, null, error.message));
        return;
      }
      throw error;
    }
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
