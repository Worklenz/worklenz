import express from "express";

import TaskCommentsController from "../../controllers/task-comments-controller";

import idParamValidator from "../../middlewares/validators/id-param-validator";
import taskCommentBodyValidator from "../../middlewares/validators/task-comment-body-validator";
import safeControllerFunction from "../../shared/safe-controller-function";

const taskCommentsApiRouter = express.Router();

taskCommentsApiRouter.post("/", taskCommentBodyValidator, safeControllerFunction(TaskCommentsController.create));
taskCommentsApiRouter.get("/:id", idParamValidator, safeControllerFunction(TaskCommentsController.getByTaskId));
taskCommentsApiRouter.delete("/:id/:taskId", idParamValidator, safeControllerFunction(TaskCommentsController.deleteById));

export default taskCommentsApiRouter;
