import express from "express";

import ProjectsController from "../../controllers/projects-controller";
import ProgressTrackingController from "../../controllers/reporting/progress-tracking/progress-tracking-controller";

import idParamValidator from "../../middlewares/validators/id-param-validator";
import projectsBodyValidator from "../../middlewares/validators/projects-body-validator";
import teamOwnerOrAdminValidator from "../../middlewares/validators/team-owner-or-admin-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import { requireProjectPermission } from "../../middlewares/validators/require-project-permission";
import projectMemberValidator from "../../middlewares/validators/project-member-validator";
import verifyProjectAccess from "../../middlewares/verify-project-access";
import projectFilesApiRouter from "./project-files-api-router";
import projectLinksApiRouter from "./project-links-api-router";
import taskExportApiRouter from "./task-export-api-router";

const projectsApiRouter = express.Router();

// db changes. One time only
projectsApiRouter.get(
  "/update-exist-phase-colors",
  safeControllerFunction(ProjectsController.updateExistPhaseColors),
);
projectsApiRouter.get(
  "/update-exist-sort-order",
  safeControllerFunction(ProjectsController.updateExistSortOrder),
);

projectsApiRouter.post(
  "/",
  teamOwnerOrAdminValidator,
  projectsBodyValidator,
  safeControllerFunction(ProjectsController.create),
);
projectsApiRouter.get("/", safeControllerFunction(ProjectsController.get));
projectsApiRouter.get(
  "/grouped",
  safeControllerFunction(ProjectsController.getGrouped),
);
projectsApiRouter.get(
  "/my-task-projects",
  safeControllerFunction(ProjectsController.getMyProjectsToTasks),
);
projectsApiRouter.get(
  "/my-projects",
  safeControllerFunction(ProjectsController.getMyProjects),
);
projectsApiRouter.get(
  "/all",
  safeControllerFunction(ProjectsController.getAllProjects),
);
projectsApiRouter.get(
  "/tasks",
  safeControllerFunction(ProjectsController.getAllTasks),
);
projectsApiRouter.get(
  "/members/:id",
  idParamValidator,
  verifyProjectAccess("params", "id"),
  safeControllerFunction(ProjectsController.getMembersByProjectId),
);
projectsApiRouter.get(
  "/overview/:id",
  idParamValidator,
  verifyProjectAccess("params", "id"),
  safeControllerFunction(ProjectsController.getOverview),
);
projectsApiRouter.get(
  "/overview-members/:id",
  idParamValidator,
  verifyProjectAccess("params", "id"),
  safeControllerFunction(ProjectsController.getOverviewMembers),
);
projectsApiRouter.get(
  "/favorite/:id",
  idParamValidator,
  verifyProjectAccess("params", "id"),
  safeControllerFunction(ProjectsController.toggleFavorite),
);
projectsApiRouter.get(
  "/archive/:id",
  idParamValidator,
  verifyProjectAccess("params", "id"),
  safeControllerFunction(ProjectsController.toggleArchive),
);
projectsApiRouter.get(
  "/delivery-confidence/:id",
  idParamValidator,
  verifyProjectAccess("params", "id"),
  safeControllerFunction(ProgressTrackingController.getByProject),
);
projectsApiRouter.patch(
  "/delivery-confidence/:id",
  idParamValidator,
  verifyProjectAccess("params", "id"),
  safeControllerFunction(ProgressTrackingController.update),
);
projectsApiRouter.get(
  "/:id",
  idParamValidator,
  verifyProjectAccess("params", "id"),
  safeControllerFunction(ProjectsController.getById),
);
projectsApiRouter.put(
  "/update-pinned-view",
  projectMemberValidator,
  safeControllerFunction(ProjectsController.updatePinnedView),
);
projectsApiRouter.put(
  "/:id",
  requireProjectPermission("settings", {
    sources: ["query.current_project_id", "params.id"],
  }),
  idParamValidator,
  projectsBodyValidator,
  safeControllerFunction(ProjectsController.update),
);
projectsApiRouter.delete(
  "/:id",
  requireProjectPermission("delete", {
    sources: ["params.id", "query.current_project_id"],
  }),
  idParamValidator,
  safeControllerFunction(ProjectsController.deleteById),
);
projectsApiRouter.get(
  "/archive-all/:id",
  requireProjectPermission("archive", {
    sources: ["params.id", "query.current_project_id"],
  }),
  idParamValidator,
  safeControllerFunction(ProjectsController.toggleArchiveAll),
);

projectsApiRouter.use("/:projectId/files", projectFilesApiRouter);
projectsApiRouter.use("/:projectId/links", projectLinksApiRouter);
projectsApiRouter.use("/:projectId/task-exports", taskExportApiRouter);

export default projectsApiRouter;
