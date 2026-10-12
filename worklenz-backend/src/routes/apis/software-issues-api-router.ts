import express from "express";

import SoftwareIssuesController from "../../controllers/software-issues-controller";
import safeControllerFunction from "../../shared/safe-controller-function";
import { requireProjectPermission } from "../../middlewares/validators/require-project-permission";

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

export default softwareIssuesApiRouter;
