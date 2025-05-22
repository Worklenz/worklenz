import express from "express";

import ProjectfinanceController from "../../controllers/project-finance-controller";

const projectFinanceApiRouter = express.Router();

projectFinanceApiRouter.get("/project/:project_id/tasks", ProjectfinanceController.getTasks);

export default projectFinanceApiRouter;