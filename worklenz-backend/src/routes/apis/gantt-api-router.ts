import express from "express";

import GanttController from "../../controllers/gantt-controller";
import safeControllerFunction from "../../shared/safe-controller-function";
import verifyProjectAccess from "../../middlewares/verify-project-access";
import verifyGuestViewAccess from "../../middlewares/verify-guest-view-access";

const ganttApiRouter = express.Router();

ganttApiRouter.get("/project-phase-label", safeControllerFunction(GanttController.getPhaseLabel));

// Roadmap/Gantt view restricted for guests
ganttApiRouter.get("/project-roadmap", verifyProjectAccess('query', 'project_id'), verifyGuestViewAccess('query', 'project_id', 'roadmap'), safeControllerFunction(GanttController.get));
ganttApiRouter.get("/project-phases/:id", verifyProjectAccess('params', 'id'), verifyGuestViewAccess('params', 'id', 'roadmap'), safeControllerFunction(GanttController.getPhasesByProject));

// Workload view restricted for guests
ganttApiRouter.get("/project-workload", verifyProjectAccess('query', 'project_id'), verifyGuestViewAccess('query', 'project_id', 'workload'), safeControllerFunction(GanttController.getWorkload));

export default ganttApiRouter;