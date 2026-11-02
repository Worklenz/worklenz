import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import WorklenzControllerBase from "../worklenz-controller-base";
import HandleExceptions from "../../decorators/handle-exceptions";
import {
  buildPlannedVsActualTasksCsv,
  getPlannedVsActualTasksSeries,
  parsePlannedVsActualTasksFilters,
} from "../../services/reporting-analytics/planned-vs-actual-tasks.service";

type AnalyticsRequest = IWorkLenzRequest & {
  analyticsAccessibleProjectIds?: string[];
};

/** Trust middleware-resolved project scope; do not re-expand (overwrites project filters). */
function accessibleProjectIds(req: IWorkLenzRequest): string[] {
  return (req as AnalyticsRequest).analyticsAccessibleProjectIds ?? [];
}

export default class PlannedVsActualTasksController extends WorklenzControllerBase {
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
    const filters = parsePlannedVsActualTasksFilters(
      req.query as Record<string, unknown>,
      accessible,
      teamId
    );

    const data = await getPlannedVsActualTasksSeries(filters);
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
    const filters = parsePlannedVsActualTasksFilters(body, accessible, teamId);

    const data = await getPlannedVsActualTasksSeries(filters);
    const csv = buildPlannedVsActualTasksCsv(data);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="planned-vs-actual-tasks.csv"'
    );
    return res.status(200).send(csv);
  }
}
