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
  CfdSeriesResult,
  getCfdSeries,
  parseCfdFilters,
} from "../../services/reporting-analytics/cfd-series.service";
import { CfdSnapshotLockBusyError } from "../../services/reporting-analytics/cfd-snapshot.service";

type AnalyticsRequest = IWorkLenzRequest & {
  analyticsAccessibleProjectIds?: string[];
};

/** Trust middleware-resolved project scope; do not re-expand (overwrites project filters). */
function accessibleProjectIds(req: IWorkLenzRequest): string[] {
  return (req as AnalyticsRequest).analyticsAccessibleProjectIds ?? [];
}

/** Send a retryable service-unavailable response for snapshot lock contention. */
function handleSnapshotLockBusy(
  error: unknown,
  res: IWorkLenzResponse
): boolean {
  if (!(error instanceof CfdSnapshotLockBusyError)) return false;
  res.setHeader("Retry-After", "1");
  res.status(503).send(new ServerResponse(false, null, error.message));
  return true;
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

    const accessible = accessibleProjectIds(req);
    const input = {
      ...(req.query as Record<string, unknown>),
      ...((req.body as Record<string, unknown> | undefined) ?? {}),
    };
    let filters: CfdSeriesFilters;
    try {
      filters = parseCfdFilters(input, accessible, teamId);
    } catch (error) {
      if (error instanceof InvalidCfdDateRangeError) {
        return res.status(400).send(new ServerResponse(false, null, error.message));
      }
      throw error;
    }
    let data: CfdSeriesResult;
    try {
      data = await getCfdSeries(filters);
    } catch (error) {
      if (handleSnapshotLockBusy(error, res)) return res;
      throw error;
    }
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
    let data: CfdSeriesResult;
    try {
      data = await getCfdSeries(filters);
    } catch (error) {
      if (handleSnapshotLockBusy(error, res)) return;
      throw error;
    }
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
