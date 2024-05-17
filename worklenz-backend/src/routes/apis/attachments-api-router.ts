import express from "express";

import AttachmentController from "../../controllers/attachment-controller";

import imageToWebp from "../../middlewares/image-to-webp";
import avatarValidator from "../../middlewares/validators/avatar-validator";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import taskAttachmentsValidator from "../../middlewares/validators/task-attachments-validator";
import safeControllerFunction from "../../shared/safe-controller-function";

const attachmentsApiRouter = express.Router();

attachmentsApiRouter.post("/tasks", taskAttachmentsValidator, safeControllerFunction(AttachmentController.createTaskAttachment));
attachmentsApiRouter.post("/avatar", avatarValidator, safeControllerFunction(imageToWebp), safeControllerFunction(AttachmentController.createAvatarAttachment));
attachmentsApiRouter.get("/tasks/:id", idParamValidator, safeControllerFunction(AttachmentController.get));
attachmentsApiRouter.get("/download", safeControllerFunction(AttachmentController.download));
attachmentsApiRouter.get("/project/:id", idParamValidator, safeControllerFunction(AttachmentController.getByProjectId));
attachmentsApiRouter.delete("/tasks/:id", idParamValidator, safeControllerFunction(AttachmentController.deleteById));

export default attachmentsApiRouter;
