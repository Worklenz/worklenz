import express from "express";
import safeControllerFunction from "../../shared/safe-controller-function";
import analyticsProjectAccessMiddleware from "../../middlewares/analytics-project-access";
import { canViewAnalyticsReports } from "../../shared/reporting-analytics-permissions";
import { withLastUpdated } from "../../redis/analytics-cache";
import { ServerResponse } from "../../models/server-response";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";

const router = express.Router();

async function requireAnalyticsAccess(
  req: IWorkLenzRequest,
  res: IWorkLenzResponse,
  next: express.NextFunction
) {
  if (!canViewAnalyticsReports(req.user)) {
    return res.status(403).send(new ServerResponse(false, null, "Guests cannot access analytics"));
  }
  return next();
}

/**
 * Phase 1 stub endpoints — real report controllers land in later phases.
 * Every route runs project-scoped access middleware.
 */
router.get(
  "/meta",
  requireAnalyticsAccess,
  analyticsProjectAccessMiddleware,
  safeControllerFunction(async (req: IWorkLenzRequest, res: IWorkLenzResponse) => {
    const projectIds =
      (req as IWorkLenzRequest & { analyticsAccessibleProjectIds?: string[] })
        .analyticsAccessibleProjectIds ?? [];

    return res.status(200).send(
      new ServerResponse(
        true,
        withLastUpdated({
          accessible_project_count: projectIds.length,
          reports: ["dashboards", "velocity", "cumulative-flow", "sla", "time-in-status"],
        })
      )
    );
  })
);

export default router;
