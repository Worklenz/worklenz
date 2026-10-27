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
import TimeInStatusController from "../../controllers/reporting-analytics/time-in-status-controller";
import ProjectHealthController from "../../controllers/reporting-analytics/project-health-controller";
import PlannedVsActualTasksController from "../../controllers/reporting-analytics/planned-vs-actual-tasks-controller";
import PlannedVsActualMilestonesController from "../../controllers/reporting-analytics/planned-vs-actual-milestones-controller";
import UtilizationController from "../../controllers/reporting-analytics/utilization-controller";
import TimeReportController from "../../controllers/reporting-analytics/time-report-controller";
import BudgetTrackingController from "../../controllers/reporting-analytics/budget-tracking-controller";
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
          reports: [
            "dashboards",
            "velocity",
            "cumulative-flow",
            "sla",
            "time-in-status",
            "project-health",
            "planned-vs-actual-tasks",
            "planned-vs-actual-milestones",
            "utilization",
            "time-report",
            "budget-tracking",
          ],
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

// —— Time in Status (Phase 4) ——
router.get(
  "/time-in-status/series",
  requireAnalyticsAccess,
  analyticsProjectAccessMiddleware,
  safeControllerFunction(TimeInStatusController.getSeries)
);

router.get(
  "/time-in-status/filter-options",
  requireAnalyticsAccess,
  analyticsProjectAccessMiddleware,
  safeControllerFunction(TimeInStatusController.getFilterOptions)
);

router.post(
  "/time-in-status/export/csv",
  requireAnalyticsAccess,
  analyticsProjectAccessMiddleware,
  safeControllerFunction(TimeInStatusController.exportCsv)
);

// —— Project Health ——
router.get(
  "/project-health/series",
  requireAnalyticsAccess,
  analyticsProjectAccessMiddleware,
  safeControllerFunction(ProjectHealthController.getSeries)
);

router.post(
  "/project-health/export/csv",
  requireAnalyticsAccess,
  analyticsProjectAccessMiddleware,
  safeControllerFunction(ProjectHealthController.exportCsv)
);

// —— Planned vs Actual: Tasks ——
router.get(
  "/planned-vs-actual-tasks/series",
  requireAnalyticsAccess,
  analyticsProjectAccessMiddleware,
  safeControllerFunction(PlannedVsActualTasksController.getSeries)
);

router.post(
  "/planned-vs-actual-tasks/export/csv",
  requireAnalyticsAccess,
  analyticsProjectAccessMiddleware,
  safeControllerFunction(PlannedVsActualTasksController.exportCsv)
);

// —— Planned vs Actual: Milestones ——
router.get(
  "/planned-vs-actual-milestones/series",
  requireAnalyticsAccess,
  analyticsProjectAccessMiddleware,
  safeControllerFunction(PlannedVsActualMilestonesController.getSeries)
);

router.post(
  "/planned-vs-actual-milestones/export/csv",
  requireAnalyticsAccess,
  analyticsProjectAccessMiddleware,
  safeControllerFunction(PlannedVsActualMilestonesController.exportCsv)
);

// —— Utilization (capacity = working hours, logged = logged time) ——
router.get(
  "/utilization/series",
  requireAnalyticsAccess,
  analyticsProjectAccessMiddleware,
  safeControllerFunction(UtilizationController.getSeries)
);

router.post(
  "/utilization/export/csv",
  requireAnalyticsAccess,
  analyticsProjectAccessMiddleware,
  safeControllerFunction(UtilizationController.exportCsv)
);

// —— Time Report (logged vs estimated + billable split) ——
router.get(
  "/time-report/series",
  requireAnalyticsAccess,
  analyticsProjectAccessMiddleware,
  safeControllerFunction(TimeReportController.getSeries)
);

router.post(
  "/time-report/export/csv",
  requireAnalyticsAccess,
  analyticsProjectAccessMiddleware,
  safeControllerFunction(TimeReportController.exportCsv)
);

// —— Budget Tracking (budget vs spent by project) ——
router.get(
  "/budget-tracking/series",
  requireAnalyticsAccess,
  analyticsProjectAccessMiddleware,
  safeControllerFunction(BudgetTrackingController.getSeries)
);

router.post(
  "/budget-tracking/export/csv",
  requireAnalyticsAccess,
  analyticsProjectAccessMiddleware,
  safeControllerFunction(BudgetTrackingController.exportCsv)
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
