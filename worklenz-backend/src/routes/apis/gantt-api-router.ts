import express from "express";

import GanttController from "../../controllers/gantt-controller";
import safeControllerFunction from "../../shared/safe-controller-function";
import verifyProjectAccess from "../../middlewares/verify-project-access";

const ganttApiRouter = express.Router();

ganttApiRouter.get("/project-phase-label", safeControllerFunction(GanttController.getPhaseLabel));

ganttApiRouter.get("/project-roadmap", verifyProjectAccess('query', 'project_id'), safeControllerFunction(GanttController.get));
ganttApiRouter.get("/project-phases/:id", verifyProjectAccess('params', 'id'), safeControllerFunction(GanttController.getPhasesByProject));

ganttApiRouter.get("/project-workload", verifyProjectAccess('query', 'project_id'), safeControllerFunction(GanttController.getWorkload));

export default ganttApiRouter;