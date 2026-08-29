import express from "express";

import ProjectfinanceController from "../../controllers/project-finance-controller";
import idParamValidator from "../../../middlewares/validators/id-param-validator";
import teamLeadFinanceValidator from "../../../middlewares/validators/team-lead-finance-validator";
import safeControllerFunction from "../../../shared/safe-controller-function";
import { requireBusinessPlan } from "../../middlewares/subscription-middleware";

const projectFinanceApiRouter = express.Router();

// Project finance is a Business Edition feature — gate every route server-side.
projectFinanceApiRouter.use(requireBusinessPlan);

projectFinanceApiRouter.get(
  "/project/:project_id/tasks",
  teamLeadFinanceValidator,
  safeControllerFunction(ProjectfinanceController.getTasks)
);
projectFinanceApiRouter.get(
  "/project/:project_id/tasks/:parent_task_id/subtasks",
  teamLeadFinanceValidator,
  safeControllerFunction(ProjectfinanceController.getSubTasks)
);
projectFinanceApiRouter.get(
  "/task/:id/breakdown",
  idParamValidator,
  teamLeadFinanceValidator,
  safeControllerFunction(ProjectfinanceController.getTaskBreakdown)
);
projectFinanceApiRouter.put(
  "/task/:task_id/fixed-cost",
  teamLeadFinanceValidator,
  safeControllerFunction(ProjectfinanceController.updateTaskFixedCost)
);

projectFinanceApiRouter.put(
  "/project/:project_id/currency",
  teamLeadFinanceValidator,
  safeControllerFunction(ProjectfinanceController.updateProjectCurrency)
);
projectFinanceApiRouter.put(
  "/project/:project_id/budget",
  teamLeadFinanceValidator,
  safeControllerFunction(ProjectfinanceController.updateProjectBudget)
);
projectFinanceApiRouter.put(
  "/project/:project_id/calculation-method",
  teamLeadFinanceValidator,
  safeControllerFunction(
    ProjectfinanceController.updateProjectCalculationMethod
  )
);
projectFinanceApiRouter.put(
  "/rate-card-role/:rate_card_role_id/man-day-rate",
  teamLeadFinanceValidator,
  safeControllerFunction(ProjectfinanceController.updateRateCardManDayRate)
);
projectFinanceApiRouter.get(
  "/project/:project_id/export",
  teamLeadFinanceValidator,
  safeControllerFunction(ProjectfinanceController.exportFinanceData)
);

export default projectFinanceApiRouter;
