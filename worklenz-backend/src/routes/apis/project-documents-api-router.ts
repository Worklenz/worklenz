import express from "express";

import ProjectDocumentsController from "../../controllers/project-documents-controller";
import { attachDocumentProject, attachTaskProject } from "../../middlewares/project-document-access";
import { documentFavoriteRateLimiter } from "../../middlewares/project-document-favorite-rate-limiter";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import requireProjectPermission from "../../middlewares/validators/require-project-permission";
import verifyProjectAccess from "../../middlewares/verify-project-access";
import { ServerResponse } from "../../models/server-response";
import safeControllerFunction from "../../shared/safe-controller-function";
import { isValidUuid } from "../../shared/validation-helpers";

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
  "/favorites",
  (req, res, next) => {
    const projectId = req.query.project_id;
    if (typeof projectId !== "string" || !isValidUuid(projectId)) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid project id"));
    }
    return next();
  },
  verifyProjectAccess("query", "project_id"),
  docsPermission,
  safeControllerFunction(ProjectDocumentsController.favorites)
);
projectDocumentsApiRouter.put(
  "/:id/favorite",
  documentFavoriteRateLimiter,
  idParamValidator,
  attachDocumentProject,
  verifyProjectAccess("query", "project_id"),
  docsPermission,
  safeControllerFunction(ProjectDocumentsController.setFavorite)
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
