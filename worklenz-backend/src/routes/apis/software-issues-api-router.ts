import express from "express";

import SoftwareIssuesController from "../../controllers/software-issues-controller";
import safeControllerFunction from "../../shared/safe-controller-function";
import { requireProjectPermission } from "../../middlewares/validators/require-project-permission";
import { verifyNonGuestProjectAccess } from "../../middlewares/verify-project-access";
import { PROJECT_ROLE_PERMISSIONS } from "../../shared/organization-permissions";

const softwareIssuesApiRouter = express.Router();

softwareIssuesApiRouter.get(
  "/",
  requireProjectPermission("tasks", { sources: ["query.project_id"] }),
  safeControllerFunction(SoftwareIssuesController.list)
);

softwareIssuesApiRouter.post(
  "/",
  requireProjectPermission("tasks", { sources: ["body.project_id"] }),
  safeControllerFunction(SoftwareIssuesController.create)
);

softwareIssuesApiRouter.put(
  "/:taskId/type",
  requireProjectPermission("tasks", { sources: ["body.project_id"] }),
  verifyNonGuestProjectAccess("body", "project_id", PROJECT_ROLE_PERMISSIONS.EDIT_TASKS),
  safeControllerFunction(SoftwareIssuesController.updateType)
);

export default softwareIssuesApiRouter;
