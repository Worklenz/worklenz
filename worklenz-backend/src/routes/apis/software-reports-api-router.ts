import express from "express";

import SoftwareReportsController from "../../controllers/software-reports-controller";
import CustomReportsController from "../../controllers/custom-reports-controller";
import safeControllerFunction from "../../shared/safe-controller-function";
import { requireProjectPermission } from "../../middlewares/validators/require-project-permission";

const softwareReportsApiRouter = express.Router();

const requireQueryProjectAccess = requireProjectPermission("tasks", { sources: ["query.project_id"] });
const requireBodyProjectAccess = requireProjectPermission("tasks", { sources: ["body.project_id"] });

softwareReportsApiRouter.get("/sprint", requireQueryProjectAccess, safeControllerFunction(SoftwareReportsController.getSprintReport));
softwareReportsApiRouter.get("/flow", requireQueryProjectAccess, safeControllerFunction(SoftwareReportsController.getFlowReport));
softwareReportsApiRouter.get("/cycle-time", requireQueryProjectAccess, safeControllerFunction(SoftwareReportsController.getCycleTimeReport));

softwareReportsApiRouter.get("/custom", requireQueryProjectAccess, safeControllerFunction(CustomReportsController.list));
softwareReportsApiRouter.post("/custom", requireBodyProjectAccess, safeControllerFunction(CustomReportsController.create));
softwareReportsApiRouter.post("/custom/preview", requireBodyProjectAccess, safeControllerFunction(CustomReportsController.preview));
softwareReportsApiRouter.get("/custom/:id/data", requireQueryProjectAccess, safeControllerFunction(CustomReportsController.getData));
softwareReportsApiRouter.delete("/custom/:id", requireQueryProjectAccess, safeControllerFunction(CustomReportsController.remove));

export default softwareReportsApiRouter;
