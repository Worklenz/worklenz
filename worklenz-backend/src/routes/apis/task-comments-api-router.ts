import express from "express";

import TaskCommentsController from "../../controllers/task-comments-controller";

import idParamValidator from "../../middlewares/validators/id-param-validator";
import taskCommentBodyValidator from "../../middlewares/validators/task-comment-body-validator";
import taskCommentAttachmentValidator from "../../middlewares/validators/task-comment-attachment-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import verifyTaskAccess, {verifyTaskAccessViaComment, verifyTaskAccessViaCommentAttachment, verifyNonGuestTaskAccess, verifyTaskRolePermission} from "../../middlewares/verify-task-access";
import { PROJECT_ROLE_PERMISSIONS } from "../../shared/organization-permissions";

const taskCommentsApiRouter = express.Router();

taskCommentsApiRouter.post("/", taskCommentBodyValidator, verifyTaskAccess('body', 'task_id'), verifyTaskRolePermission('body', 'task_id', PROJECT_ROLE_PERMISSIONS.COMMENT), safeControllerFunction(TaskCommentsController.create));
taskCommentsApiRouter.get("/download", verifyTaskAccessViaCommentAttachment('query', 'id'), safeControllerFunction(TaskCommentsController.download));
taskCommentsApiRouter.get("/resolve/:id", idParamValidator, verifyTaskAccessViaComment('params', 'id'), safeControllerFunction(TaskCommentsController.resolveShortLink));
taskCommentsApiRouter.get("/:id", idParamValidator, verifyTaskAccess('params', 'id'), safeControllerFunction(TaskCommentsController.getByTaskId));
taskCommentsApiRouter.delete("/attachment/:id/:taskId", idParamValidator, verifyNonGuestTaskAccess('params', 'taskId', PROJECT_ROLE_PERMISSIONS.COMMENT), safeControllerFunction(TaskCommentsController.deleteAttachmentById));

taskCommentsApiRouter.delete("/:id/:taskId", idParamValidator, verifyTaskAccess('params', 'taskId'), verifyTaskRolePermission('params', 'taskId', PROJECT_ROLE_PERMISSIONS.COMMENT), safeControllerFunction(TaskCommentsController.deleteById));

taskCommentsApiRouter.put("/reaction/:id", verifyTaskAccessViaComment('params', 'id'), safeControllerFunction(TaskCommentsController.updateReaction));
taskCommentsApiRouter.put("/:id", taskCommentBodyValidator, verifyTaskAccessViaComment('params', 'id'), safeControllerFunction(TaskCommentsController.update));
taskCommentsApiRouter.post("/attachment", taskCommentAttachmentValidator, verifyTaskAccess('body', 'task_id'), verifyTaskRolePermission('body', 'task_id', PROJECT_ROLE_PERMISSIONS.COMMENT), safeControllerFunction(TaskCommentsController.createAttachment));

export default taskCommentsApiRouter;
