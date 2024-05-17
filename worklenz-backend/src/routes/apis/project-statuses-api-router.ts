import express from "express";

import ProjectstatusesController from "../../controllers/project-statuses-controller";
import safeControllerFunction from "../../shared/safe-controller-function";

const projectStatusesApiRouter = express.Router();

projectStatusesApiRouter.get("/", safeControllerFunction(ProjectstatusesController.get));

export default projectStatusesApiRouter;
