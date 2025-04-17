import express from "express";

import TaskCommentsController from "../../controllers/task-comments-controller";

import idParamValidator from "../../middlewares/validators/id-param-validator";
import taskCommentBodyValidator from "../../middlewares/validators/task-comment-body-validator";
import taskCommentAttachmentValidator from "../../middlewares/validators/task-comment-attachment-validator";
import safeControllerFunction from "../../shared/safe-controller-function";

const taskCommentsApiRouter = express.Router();

taskCommentsApiRouter.post("/", taskCommentBodyValidator, safeControllerFunction(TaskCommentsController.create));
taskCommentsApiRouter.get("/download", safeControllerFunction(TaskCommentsController.download));
taskCommentsApiRouter.get("/:id", idParamValidator, safeControllerFunction(TaskCommentsController.getByTaskId));
taskCommentsApiRouter.delete("/attachment/:id/:taskId", idParamValidator, safeControllerFunction(TaskCommentsController.deleteAttachmentById));

taskCommentsApiRouter.delete("/:id/:taskId", idParamValidator, safeControllerFunction(TaskCommentsController.deleteById));

taskCommentsApiRouter.put("/reaction/:id", safeControllerFunction(TaskCommentsController.updateReaction));
taskCommentsApiRouter.put("/:id", safeControllerFunction(TaskCommentsController.update));
taskCommentsApiRouter.post("/attachment", taskCommentAttachmentValidator, safeControllerFunction(TaskCommentsController.createAttachment));

export default taskCommentsApiRouter;
