import express from "express";

import GanttController from "../../controllers/gantt-controller";
import safeControllerFunction from "../../shared/safe-controller-function";

const ganttApiRouter = express.Router();

ganttApiRouter.get("/project-phase-label", safeControllerFunction(GanttController.getPhaseLabel));

ganttApiRouter.get("/project-roadmap", safeControllerFunction(GanttController.get));
ganttApiRouter.get("/project-phases/:id", safeControllerFunction(GanttController.getPhasesByProject));

ganttApiRouter.get("/project-workload", safeControllerFunction(GanttController.getWorkload));

export default ganttApiRouter;