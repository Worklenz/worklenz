import express from "express";

import TaskCommentsController from "../../controllers/task-comments-controller";

import idParamValidator from "../../middlewares/validators/id-param-validator";
import taskCommentBodyValidator from "../../middlewares/validators/task-comment-body-validator";
import taskCommentAttachmentValidator from "../../middlewares/validators/task-comment-attachment-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import verifyTaskAccess, {verifyTaskAccessViaComment, verifyTaskAccessViaCommentAttachment, verifyNonGuestTaskAccess, verifyTaskRolePermission} from "../../middlewares/verify-task-access";
import {PROJECT_ROLE_PERMISSIONS} from "../../shared/organization-permissions";

const taskCommentsApiRouter = express.Router();
const COMMENT = PROJECT_ROLE_PERMISSIONS.COMMENT;

taskCommentsApiRouter.post("/", taskCommentBodyValidator, verifyTaskAccess('body', 'task_id'), verifyTaskRolePermission('body', 'task_id', COMMENT), safeControllerFunction(TaskCommentsController.create));
taskCommentsApiRouter.get("/download", safeControllerFunction(TaskCommentsController.download));
taskCommentsApiRouter.get("/resolve/:id", idParamValidator, verifyTaskAccessViaComment('params', 'id'), safeControllerFunction(TaskCommentsController.resolveShortLink));
taskCommentsApiRouter.get("/:id", idParamValidator, verifyTaskAccess('params', 'id'), safeControllerFunction(TaskCommentsController.getByTaskId));
taskCommentsApiRouter.delete("/attachment/:id/:taskId", idParamValidator, verifyNonGuestTaskAccess('params', 'taskId', COMMENT), safeControllerFunction(TaskCommentsController.deleteAttachmentById));

taskCommentsApiRouter.delete("/:id/:taskId", idParamValidator, verifyTaskAccess('params', 'taskId'), verifyTaskRolePermission('params', 'taskId', COMMENT), safeControllerFunction(TaskCommentsController.deleteById));

taskCommentsApiRouter.put("/reaction/:id", verifyTaskAccessViaComment('params', 'id'), safeControllerFunction(TaskCommentsController.updateReaction));
taskCommentsApiRouter.put("/:id", taskCommentBodyValidator, verifyTaskAccessViaComment('params', 'id', COMMENT), safeControllerFunction(TaskCommentsController.update));
taskCommentsApiRouter.post("/attachment", taskCommentAttachmentValidator, verifyTaskAccess('body', 'task_id'), verifyTaskRolePermission('body', 'task_id', COMMENT), safeControllerFunction(TaskCommentsController.createAttachment));

export default taskCommentsApiRouter;
