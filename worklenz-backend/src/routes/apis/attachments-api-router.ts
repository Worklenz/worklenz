import express from "express";

import AttachmentController from "../../controllers/attachment-controller";

import imageToWebp from "../../middlewares/image-to-webp";
import avatarValidator from "../../middlewares/validators/avatar-validator";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import taskAttachmentsValidator from "../../middlewares/validators/task-attachments-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import verifyTaskAccess from "../../middlewares/verify-task-access";
import {verifyNonGuestTaskAccessViaAttachment, verifyTaskAccessViaAttachment} from "../../middlewares/verify-task-access";

const attachmentsApiRouter = express.Router();

// New presigned URL upload flow (3-step: presign → upload → confirm)
// Put these BEFORE the generic /tasks route so they match first
attachmentsApiRouter.post("/tasks/presign", verifyTaskAccess('body', 'task_id'), safeControllerFunction(AttachmentController.presignTaskAttachment));
attachmentsApiRouter.post("/tasks/confirm", verifyTaskAccess('body', 'task_id'), safeControllerFunction(AttachmentController.confirmTaskAttachment));

// Legacy base64 upload (kept for backward compatibility)
attachmentsApiRouter.post("/tasks", taskAttachmentsValidator, verifyTaskAccess('body', 'task_id'), safeControllerFunction(AttachmentController.createTaskAttachment));

// Avatar uploads
attachmentsApiRouter.post("/avatar", avatarValidator, safeControllerFunction(imageToWebp), safeControllerFunction(AttachmentController.createAvatarAttachment));
attachmentsApiRouter.delete("/avatar", safeControllerFunction(AttachmentController.deleteAvatarAttachment));

// Get attachments
attachmentsApiRouter.get("/tasks/:id", idParamValidator, verifyTaskAccess('params', 'id'), safeControllerFunction(AttachmentController.get));
attachmentsApiRouter.get("/project/:id", idParamValidator, safeControllerFunction(AttachmentController.getByProjectId));

// Downloads and deletes
attachmentsApiRouter.get("/download", verifyTaskAccessViaAttachment('query', 'id'), safeControllerFunction(AttachmentController.download));
attachmentsApiRouter.delete("/tasks/:id", idParamValidator, verifyNonGuestTaskAccessViaAttachment('params', 'id'), safeControllerFunction(AttachmentController.deleteById));

export default attachmentsApiRouter;
