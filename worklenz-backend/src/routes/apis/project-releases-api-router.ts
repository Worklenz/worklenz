import express from "express";

import ProjectReleasesController from "../../controllers/project-releases-controller";
import safeControllerFunction from "../../shared/safe-controller-function";
import { requireProjectPermission } from "../../middlewares/validators/require-project-permission";

const projectReleasesApiRouter = express.Router();

const requireReleaseManagement = requireProjectPermission("phases", {
  sources: ["body.project_id"],
});
const requireTaskAccess = requireProjectPermission("tasks", {
  sources: ["query.project_id", "body.project_id"],
});

projectReleasesApiRouter.get("/", requireTaskAccess, safeControllerFunction(ProjectReleasesController.get));
projectReleasesApiRouter.get("/available-items", requireTaskAccess, safeControllerFunction(ProjectReleasesController.getAvailableItems));
projectReleasesApiRouter.get("/:id/items", requireTaskAccess, safeControllerFunction(ProjectReleasesController.getItems));
projectReleasesApiRouter.post("/", requireReleaseManagement, safeControllerFunction(ProjectReleasesController.create));
projectReleasesApiRouter.put("/assign/:taskId", requireTaskAccess, safeControllerFunction(ProjectReleasesController.assignTask));
projectReleasesApiRouter.put("/:id/release", requireReleaseManagement, safeControllerFunction(ProjectReleasesController.markReleased));
projectReleasesApiRouter.post("/:id/items", requireTaskAccess, safeControllerFunction(ProjectReleasesController.addItems));
projectReleasesApiRouter.delete("/:id/items/:taskId", requireTaskAccess, safeControllerFunction(ProjectReleasesController.removeItem));
projectReleasesApiRouter.put("/:id", requireReleaseManagement, safeControllerFunction(ProjectReleasesController.update));

export default projectReleasesApiRouter;
