import express from "express";
import safeControllerFunction from "../../shared/safe-controller-function";
import analyticsProjectAccessMiddleware from "../../middlewares/analytics-project-access";
import { canViewAnalyticsReports } from "../../shared/reporting-analytics-permissions";
import { withLastUpdated } from "../../redis/analytics-cache";
import { ServerResponse } from "../../models/server-response";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import VelocityController from "../../controllers/reporting-analytics/velocity-controller";
import CfdController from "../../controllers/reporting-analytics/cfd-controller";
import AnalyticsTemplatesController from "../../controllers/reporting-analytics/analytics-templates-controller";

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

// —— Velocity (Phase 2) ——
router.get(
  "/velocity/series",
  requireAnalyticsAccess,
  analyticsProjectAccessMiddleware,
  safeControllerFunction(VelocityController.getSeries)
);

router.post(
  "/velocity/export/excel",
  requireAnalyticsAccess,
  analyticsProjectAccessMiddleware,
  safeControllerFunction(VelocityController.exportExcel)
);

// —— Cumulative Flow (Phase 3) ——
router.get(
  "/cfd/series",
  requireAnalyticsAccess,
  analyticsProjectAccessMiddleware,
  safeControllerFunction(CfdController.getSeries)
);

router.post(
  "/cfd/export/csv",
  requireAnalyticsAccess,
  analyticsProjectAccessMiddleware,
  safeControllerFunction(CfdController.exportCsv)
);

// —— Report templates ——
router.get(
  "/templates",
  requireAnalyticsAccess,
  safeControllerFunction(AnalyticsTemplatesController.list)
);

router.post(
  "/templates",
  requireAnalyticsAccess,
  safeControllerFunction(AnalyticsTemplatesController.create)
);

router.patch(
  "/templates/:id",
  requireAnalyticsAccess,
  safeControllerFunction(AnalyticsTemplatesController.rename)
);

router.delete(
  "/templates/:id",
  requireAnalyticsAccess,
  safeControllerFunction(AnalyticsTemplatesController.remove)
);

router.post(
  "/templates/:id/default",
  requireAnalyticsAccess,
  safeControllerFunction(AnalyticsTemplatesController.setDefault)
);

router.post(
  "/templates/:id/share",
  requireAnalyticsAccess,
  safeControllerFunction(AnalyticsTemplatesController.setShare)
);

export default router;
