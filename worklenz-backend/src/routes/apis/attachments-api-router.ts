import express from "express";

import AttachmentController from "../../controllers/attachment-controller";

import imageToWebp from "../../middlewares/image-to-webp";
import avatarValidator from "../../middlewares/validators/avatar-validator";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import taskAttachmentsValidator from "../../middlewares/validators/task-attachments-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import verifyTaskAccess from "../../middlewares/verify-task-access";
import {verifyTaskAccessViaAttachment} from "../../middlewares/verify-task-access";

const attachmentsApiRouter = express.Router();

attachmentsApiRouter.post("/tasks", taskAttachmentsValidator, verifyTaskAccess('body', 'task_id'), safeControllerFunction(AttachmentController.createTaskAttachment));
attachmentsApiRouter.post("/avatar", avatarValidator, safeControllerFunction(imageToWebp), safeControllerFunction(AttachmentController.createAvatarAttachment));
attachmentsApiRouter.delete("/avatar", safeControllerFunction(AttachmentController.deleteAvatarAttachment));
attachmentsApiRouter.get("/tasks/:id", idParamValidator, verifyTaskAccess('params', 'id'), safeControllerFunction(AttachmentController.get));
attachmentsApiRouter.get("/download", safeControllerFunction(AttachmentController.download));
attachmentsApiRouter.get("/project/:id", idParamValidator, safeControllerFunction(AttachmentController.getByProjectId));
attachmentsApiRouter.delete("/tasks/:id", idParamValidator, verifyTaskAccessViaAttachment('params', 'id'), safeControllerFunction(AttachmentController.deleteById));

export default attachmentsApiRouter;
