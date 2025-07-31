import express from "express";
import safeControllerFunction from "../../shared/safe-controller-function";
import ProjectManagersController from "../../controllers/project-managers-controller";

const projectManagerApiRouter = express.Router();

projectManagerApiRouter.get("/", safeControllerFunction(ProjectManagersController.getByOrg));

export default projectManagerApiRouter;
