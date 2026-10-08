import express from "express";

import ProjectfinanceController from "../../controllers/project-finance-controller";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import { requireProjectPermission } from "../../middlewares/validators/require-project-permission";
import requireFinanceFromRelatedEntity from "../../middlewares/validators/require-finance-from-related-entity";
import safeControllerFunction from "../../shared/safe-controller-function";
import { requireBusinessPlan } from "../../middlewares/subscription-middleware";

const projectFinanceApiRouter = express.Router();

// Project finance is a Business Edition feature — gate every route server-side.
projectFinanceApiRouter.use(requireBusinessPlan);
const requireFinance = requireProjectPermission("finance", {
  sources: [
    "params.project_id",
    "body.project_id",
    "query.current_project_id",
    "query.project_id",
  ],
});

projectFinanceApiRouter.get(
  "/project/:project_id/tasks",
  requireFinance,
  safeControllerFunction(ProjectfinanceController.getTasks)
);
projectFinanceApiRouter.get(
  "/project/:project_id/tasks/:parent_task_id/subtasks",
  requireFinance,
  safeControllerFunction(ProjectfinanceController.getSubTasks)
);
projectFinanceApiRouter.get(
  "/task/:id/breakdown",
  idParamValidator,
  requireFinanceFromRelatedEntity("task_param"),
  safeControllerFunction(ProjectfinanceController.getTaskBreakdown)
);
projectFinanceApiRouter.put(
  "/task/:task_id/fixed-cost",
  requireFinanceFromRelatedEntity("task"),
  safeControllerFunction(ProjectfinanceController.updateTaskFixedCost)
);

projectFinanceApiRouter.put(
  "/project/:project_id/currency",
  requireFinance,
  safeControllerFunction(ProjectfinanceController.updateProjectCurrency)
);
projectFinanceApiRouter.put(
  "/project/:project_id/budget",
  requireFinance,
  safeControllerFunction(ProjectfinanceController.updateProjectBudget)
);
projectFinanceApiRouter.put(
  "/project/:project_id/calculation-method",
  requireFinance,
  safeControllerFunction(
    ProjectfinanceController.updateProjectCalculationMethod
  )
);
projectFinanceApiRouter.put(
  "/rate-card-role/:rate_card_role_id/man-day-rate",
  requireFinanceFromRelatedEntity("rate_card_role"),
  safeControllerFunction(ProjectfinanceController.updateRateCardManDayRate)
);
projectFinanceApiRouter.get(
  "/project/:project_id/export",
  requireFinance,
  safeControllerFunction(ProjectfinanceController.exportFinanceData)
);

export default projectFinanceApiRouter;
