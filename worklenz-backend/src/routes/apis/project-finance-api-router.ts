import express from "express";

import ProjectfinanceController from "../../controllers/project-finance-controller";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import safeControllerFunction from "../../shared/safe-controller-function";

const projectFinanceApiRouter = express.Router();

projectFinanceApiRouter.get("/project/:project_id/tasks", ProjectfinanceController.getTasks);
projectFinanceApiRouter.get(
  "/task/:id/breakdown", 
  idParamValidator,
  safeControllerFunction(ProjectfinanceController.getTaskBreakdown)
);
projectFinanceApiRouter.put("/task/:task_id/fixed-cost", ProjectfinanceController.updateTaskFixedCost);

export default projectFinanceApiRouter;