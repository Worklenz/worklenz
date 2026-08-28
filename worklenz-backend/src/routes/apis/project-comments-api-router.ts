import express from "express";

import ProjectCommentsController from "../../controllers/project-comments-controller";
import safeControllerFunction from "../../shared/safe-controller-function";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import verifyProjectAccess from "../../middlewares/verify-project-access";

const projectCommentsApiRouter = express.Router();

projectCommentsApiRouter.post("/", verifyProjectAccess('body', 'project_id'), safeControllerFunction(ProjectCommentsController.create));
projectCommentsApiRouter.post("/attachment/upload", verifyProjectAccess('body', 'project_id'), safeControllerFunction(ProjectCommentsController.uploadAttachment));
projectCommentsApiRouter.get("/inbox/conversations", safeControllerFunction(ProjectCommentsController.getInboxConversations));
projectCommentsApiRouter.get("/project-members/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(ProjectCommentsController.getMembers));
projectCommentsApiRouter.get("/project-comments/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(ProjectCommentsController.getByProjectId));
projectCommentsApiRouter.get("/comments-count/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(ProjectCommentsController.getCountByProjectId));
projectCommentsApiRouter.get("/pinned/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(ProjectCommentsController.getPinnedByProjectId));
projectCommentsApiRouter.put("/read/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(ProjectCommentsController.markAsRead));
projectCommentsApiRouter.put("/pin/:id", idParamValidator, verifyProjectAccess('body', 'project_id'), safeControllerFunction(ProjectCommentsController.setPinned));
projectCommentsApiRouter.delete("/delete/:id", idParamValidator, safeControllerFunction(ProjectCommentsController.deleteById));

export default projectCommentsApiRouter;
