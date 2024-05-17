import express from "express";
import safeControllerFunction from "../../shared/safe-controller-function";
import ProjectHealthController from "../../controllers/project-healths-controller";

const projectHealthsApiRouter = express.Router();

projectHealthsApiRouter.get("/", safeControllerFunction(ProjectHealthController.get));

export default projectHealthsApiRouter;