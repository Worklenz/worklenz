import express from "express";

import TaskCommentsController from "../../controllers/task-comments-controller";

import idParamValidator from "../../middlewares/validators/id-param-validator";
import taskCommentBodyValidator from "../../middlewares/validators/task-comment-body-validator";
import taskCommentAttachmentValidator from "../../middlewares/validators/task-comment-attachment-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import verifyTaskAccess, {verifyTaskAccessViaComment} from "../../middlewares/verify-task-access";

const taskCommentsApiRouter = express.Router();

taskCommentsApiRouter.post("/", taskCommentBodyValidator, verifyTaskAccess('body', 'task_id'), safeControllerFunction(TaskCommentsController.create));
taskCommentsApiRouter.get("/download", safeControllerFunction(TaskCommentsController.download));
taskCommentsApiRouter.get("/:id", idParamValidator, verifyTaskAccess('params', 'id'), safeControllerFunction(TaskCommentsController.getByTaskId));
taskCommentsApiRouter.delete("/attachment/:id/:taskId", idParamValidator, verifyTaskAccess('params', 'taskId'), safeControllerFunction(TaskCommentsController.deleteAttachmentById));

taskCommentsApiRouter.delete("/:id/:taskId", idParamValidator, verifyTaskAccess('params', 'taskId'), safeControllerFunction(TaskCommentsController.deleteById));

taskCommentsApiRouter.put("/reaction/:id", verifyTaskAccessViaComment('params', 'id'), safeControllerFunction(TaskCommentsController.updateReaction));
taskCommentsApiRouter.put("/:id", taskCommentBodyValidator, verifyTaskAccessViaComment('params', 'id'), safeControllerFunction(TaskCommentsController.update));
taskCommentsApiRouter.post("/attachment", taskCommentAttachmentValidator, verifyTaskAccess('body', 'task_id'), safeControllerFunction(TaskCommentsController.createAttachment));

export default taskCommentsApiRouter;
