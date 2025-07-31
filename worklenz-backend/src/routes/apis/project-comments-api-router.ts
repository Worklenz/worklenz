import express from "express";

import ProjectCommentsController from "../../controllers/project-comments-controller";
import safeControllerFunction from "../../shared/safe-controller-function";
import idParamValidator from "../../middlewares/validators/id-param-validator";

const projectCommentsApiRouter = express.Router();

projectCommentsApiRouter.post("/", safeControllerFunction(ProjectCommentsController.create));
projectCommentsApiRouter.get("/project-members/:id", idParamValidator, safeControllerFunction(ProjectCommentsController.getMembers));
projectCommentsApiRouter.get("/project-comments/:id", idParamValidator, safeControllerFunction(ProjectCommentsController.getByProjectId));
projectCommentsApiRouter.get("/comments-count/:id", idParamValidator, safeControllerFunction(ProjectCommentsController.getCountByProjectId));
projectCommentsApiRouter.delete("/delete/:id", idParamValidator, safeControllerFunction(ProjectCommentsController.deleteById));

export default projectCommentsApiRouter;
