import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import WorklenzControllerBase from "../worklenz-controller-base";
import HandleExceptions from "../../decorators/handle-exceptions";
import {
  buildUtilizationCsv,
  getUtilizationSeries,
  parseUtilizationFilters,
} from "../../services/reporting-analytics/utilization.service";

type AnalyticsRequest = IWorkLenzRequest & {
  analyticsAccessibleProjectIds?: string[];
};

/** Trust middleware-resolved project scope; do not re-expand (overwrites project filters). */
function accessibleProjectIds(req: IWorkLenzRequest): string[] {
  return (req as AnalyticsRequest).analyticsAccessibleProjectIds ?? [];
}

export default class UtilizationController extends WorklenzControllerBase {
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
    const filters = parseUtilizationFilters(
      req.query as Record<string, unknown>,
      accessible,
      teamId
    );

    const data = await getUtilizationSeries(filters);
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
    const accessible = accessibleProjectIds(req);
    const filters = parseUtilizationFilters(body, accessible, teamId);

    const data = await getUtilizationSeries(filters);
    const csv = buildUtilizationCsv(data);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="utilization.csv"');
    return res.status(200).send(csv);
  }
}
