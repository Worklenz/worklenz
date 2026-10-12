import express from "express";

import ProjectEpicsController from "../../controllers/project-epics-controller";
import safeControllerFunction from "../../shared/safe-controller-function";
import { requireProjectPermission } from "../../middlewares/validators/require-project-permission";

const projectEpicsApiRouter = express.Router();

const requireEpicManagement = requireProjectPermission("phases", {
  sources: ["body.project_id"],
});
const requireTaskAccess = requireProjectPermission("tasks", {
  sources: ["query.project_id", "body.project_id"],
});

projectEpicsApiRouter.get("/", requireTaskAccess, safeControllerFunction(ProjectEpicsController.get));
projectEpicsApiRouter.post("/", requireEpicManagement, safeControllerFunction(ProjectEpicsController.create));
projectEpicsApiRouter.put("/assign/:taskId", requireTaskAccess, safeControllerFunction(ProjectEpicsController.assignTask));
projectEpicsApiRouter.put("/:id", requireEpicManagement, safeControllerFunction(ProjectEpicsController.update));

export default projectEpicsApiRouter;
