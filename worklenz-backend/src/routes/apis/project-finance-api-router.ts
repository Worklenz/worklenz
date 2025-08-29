import express from "express";

import ProjectfinanceController from "../../controllers/project-finance-controller";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import safeControllerFunction from "../../shared/safe-controller-function";

const projectFinanceApiRouter = express.Router();

projectFinanceApiRouter.get(
  "/project/:project_id/tasks",
  safeControllerFunction(ProjectfinanceController.getTasks)
);
projectFinanceApiRouter.get(
  "/project/:project_id/tasks/:parent_task_id/subtasks",
  safeControllerFunction(ProjectfinanceController.getSubTasks)
);
projectFinanceApiRouter.get(
  "/task/:id/breakdown",
  idParamValidator,
  safeControllerFunction(ProjectfinanceController.getTaskBreakdown)
);
projectFinanceApiRouter.put(
  "/task/:task_id/fixed-cost",
  safeControllerFunction(ProjectfinanceController.updateTaskFixedCost)
);

projectFinanceApiRouter.put(
  "/project/:project_id/currency",
  safeControllerFunction(ProjectfinanceController.updateProjectCurrency)
);
projectFinanceApiRouter.put(
  "/project/:project_id/budget",
  safeControllerFunction(ProjectfinanceController.updateProjectBudget)
);
projectFinanceApiRouter.put(
  "/project/:project_id/calculation-method",
  safeControllerFunction(
    ProjectfinanceController.updateProjectCalculationMethod
  )
);
projectFinanceApiRouter.put(
  "/rate-card-role/:rate_card_role_id/man-day-rate",
  safeControllerFunction(ProjectfinanceController.updateRateCardManDayRate)
);
projectFinanceApiRouter.get(
  "/project/:project_id/export",
  safeControllerFunction(ProjectfinanceController.exportFinanceData)
);

export default projectFinanceApiRouter;
