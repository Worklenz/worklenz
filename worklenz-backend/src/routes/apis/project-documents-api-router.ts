import express from "express";

import ProjectDocumentsController from "../../controllers/project-documents-controller";
import { attachDocumentProject, attachTaskProject } from "../../middlewares/project-document-access";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import requireProjectPermission from "../../middlewares/validators/require-project-permission";
import verifyProjectAccess from "../../middlewares/verify-project-access";
import safeControllerFunction from "../../shared/safe-controller-function";

const projectDocumentsApiRouter = express.Router();
const docsPermission = requireProjectPermission("docs");

projectDocumentsApiRouter.get(
  "/search",
  verifyProjectAccess("query", "project_id"),
  docsPermission,
  safeControllerFunction(ProjectDocumentsController.search)
);
projectDocumentsApiRouter.get(
  "/task-backlinks/:taskId",
  attachTaskProject,
  verifyProjectAccess("query", "project_id"),
  docsPermission,
  safeControllerFunction(ProjectDocumentsController.taskBacklinks)
);
projectDocumentsApiRouter.get(
  "/",
  verifyProjectAccess("query", "project_id"),
  docsPermission,
  safeControllerFunction(ProjectDocumentsController.list)
);
projectDocumentsApiRouter.post(
  "/",
  verifyProjectAccess("body", "project_id"),
  docsPermission,
  safeControllerFunction(ProjectDocumentsController.create)
);
projectDocumentsApiRouter.put(
  "/reorder",
  verifyProjectAccess("body", "project_id"),
  docsPermission,
  safeControllerFunction(ProjectDocumentsController.reorder)
);
projectDocumentsApiRouter.get(
  "/:id",
  idParamValidator,
  attachDocumentProject,
  verifyProjectAccess("query", "project_id"),
  docsPermission,
  safeControllerFunction(ProjectDocumentsController.getById)
);
projectDocumentsApiRouter.put(
  "/:id",
  idParamValidator,
  attachDocumentProject,
  verifyProjectAccess("query", "project_id"),
  docsPermission,
  safeControllerFunction(ProjectDocumentsController.update)
);
projectDocumentsApiRouter.post(
  "/:id/duplicate",
  idParamValidator,
  attachDocumentProject,
  verifyProjectAccess("query", "project_id"),
  docsPermission,
  safeControllerFunction(ProjectDocumentsController.duplicate)
);
projectDocumentsApiRouter.delete(
  "/:id",
  idParamValidator,
  attachDocumentProject,
  verifyProjectAccess("query", "project_id"),
  docsPermission,
  safeControllerFunction(ProjectDocumentsController.remove)
);

export default projectDocumentsApiRouter;
