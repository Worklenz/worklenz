import express from "express";

import ProjectCommentsController from "../../controllers/project-comments-controller";
import safeControllerFunction from "../../shared/safe-controller-function";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import verifyProjectAccess from "../../middlewares/verify-project-access";

const projectCommentsApiRouter = express.Router();

projectCommentsApiRouter.post("/", verifyProjectAccess('body', 'project_id'), safeControllerFunction(ProjectCommentsController.create));
projectCommentsApiRouter.get("/project-members/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(ProjectCommentsController.getMembers));
projectCommentsApiRouter.get("/project-comments/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(ProjectCommentsController.getByProjectId));
projectCommentsApiRouter.get("/comments-count/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(ProjectCommentsController.getCountByProjectId));
projectCommentsApiRouter.delete("/delete/:id", idParamValidator, safeControllerFunction(ProjectCommentsController.deleteById));

export default projectCommentsApiRouter;
