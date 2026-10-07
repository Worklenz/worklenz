import express from "express";

import SoftwareReportsController from "../../controllers/software-reports-controller";
import CustomReportsController from "../../controllers/custom-reports-controller";
import safeControllerFunction from "../../shared/safe-controller-function";
import { requireProjectPermission } from "../../middlewares/validators/require-project-permission";

const softwareReportsApiRouter = express.Router();

const requireTaskAccess = requireProjectPermission("tasks", {
  sources: ["query.project_id", "body.project_id"],
});

softwareReportsApiRouter.get("/sprint", requireTaskAccess, safeControllerFunction(SoftwareReportsController.getSprintReport));
softwareReportsApiRouter.get("/flow", requireTaskAccess, safeControllerFunction(SoftwareReportsController.getFlowReport));
softwareReportsApiRouter.get("/cycle-time", requireTaskAccess, safeControllerFunction(SoftwareReportsController.getCycleTimeReport));

softwareReportsApiRouter.get("/custom", requireTaskAccess, safeControllerFunction(CustomReportsController.list));
softwareReportsApiRouter.post("/custom", requireTaskAccess, safeControllerFunction(CustomReportsController.create));
softwareReportsApiRouter.post("/custom/preview", requireTaskAccess, safeControllerFunction(CustomReportsController.preview));
softwareReportsApiRouter.get("/custom/:id/data", requireTaskAccess, safeControllerFunction(CustomReportsController.getData));
softwareReportsApiRouter.delete("/custom/:id", requireTaskAccess, safeControllerFunction(CustomReportsController.remove));

export default softwareReportsApiRouter;
