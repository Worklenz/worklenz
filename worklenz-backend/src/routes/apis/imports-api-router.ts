import express from "express";

import ImportsController from "../../controllers/imports-controller";
import {
  validateAttachments,
  validateCreate,
  validateFields,
  validateHierarchy,
  validateIngest,
  validateSource,
  validateTarget,
  validateTasks,
  validateUsers,
  validateValues,
} from "../../middlewares/validators/imports-validator";

const importsApiRouter = express.Router();

importsApiRouter.post("/", validateCreate, ImportsController.create);
importsApiRouter.post(
  "/:jobId/target",
  validateTarget,
  ImportsController.setTarget,
);
importsApiRouter.post(
  "/:jobId/source",
  validateSource,
  ImportsController.setSource,
);
importsApiRouter.get("/:jobId", ImportsController.get);
importsApiRouter.post(
  "/:jobId/auth/asana/start",
  ImportsController.startAsanaAuth,
);
importsApiRouter.post(
  "/:jobId/hierarchy/auto",
  ImportsController.autoHierarchy,
);
importsApiRouter.get("/auth/asana/callback", ImportsController.asanaCallback);
importsApiRouter.post("/:jobId/fields/auto", ImportsController.autoFields);
importsApiRouter.post(
  "/:jobId/fields",
  validateFields,
  ImportsController.saveFields,
);
importsApiRouter.post(
  "/:jobId/hierarchy",
  validateHierarchy,
  ImportsController.saveHierarchy,
);
importsApiRouter.post(
  "/:jobId/value-mappings",
  validateValues,
  ImportsController.saveValueMappings,
);
importsApiRouter.post(
  "/:jobId/user-mappings",
  validateUsers,
  ImportsController.saveUserMappings,
);
importsApiRouter.post(
  "/:jobId/auth/monday/validate",
  ImportsController.mondayValidate,
);
importsApiRouter.post(
  "/:jobId/attachments",
  validateAttachments,
  ImportsController.saveAttachments,
);
importsApiRouter.post(
  "/:jobId/stage-tasks",
  validateTasks,
  ImportsController.saveStageTasks,
);
importsApiRouter.get("/:jobId/stage-tasks", ImportsController.listStageTasks);
importsApiRouter.post(
  "/:jobId/ingest",
  validateIngest,
  ImportsController.ingest,
);
importsApiRouter.post(
  "/:jobId/auth/clickup/workspaces",
  ImportsController.clickupWorkspaces,
);
importsApiRouter.post(
  "/:jobId/auth/trello/validate",
  ImportsController.trelloValidate,
);
importsApiRouter.post(
  "/:jobId/auth/jira/validate",
  ImportsController.jiraValidate,
);
importsApiRouter.get("/:jobId/progress", ImportsController.progress);
importsApiRouter.get("/:jobId/logs", ImportsController.logs);
importsApiRouter.post("/:jobId/commit", ImportsController.commit);
importsApiRouter.post("/:jobId/cancel", ImportsController.cancel);

export default importsApiRouter;
