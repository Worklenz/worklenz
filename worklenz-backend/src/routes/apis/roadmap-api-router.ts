import express from "express";

import GanttController from "../../controllers/gantt-controller";
import safeControllerFunction from "../../shared/safe-controller-function";
import verifyProjectAccess, { verifyNonGuestProjectAccess } from "../../middlewares/verify-project-access";
import { verifyNonGuestTaskAccess } from "../../middlewares/verify-task-access";
import verifyGuestViewAccess from "../../middlewares/verify-guest-view-access";
import { requireProjectPermission } from "../../middlewares/validators/require-project-permission";

const ganttApiRouter = express.Router();

const requirePhases = requireProjectPermission("phases", {
  sources: ["body.project_id", "query.project_id", "query.current_project_id"],
});

ganttApiRouter.get("/project-phase-label", safeControllerFunction(GanttController.getPhaseLabel));

ganttApiRouter.get("/project-roadmap", safeControllerFunction(GanttController.get));
ganttApiRouter.get("/project-phases/:id", safeControllerFunction(GanttController.getPhasesByProject));

ganttApiRouter.get("/project-workload", safeControllerFunction(GanttController.getWorkload));

// New roadmap Gantt APIs
ganttApiRouter.get("/roadmap-tasks", verifyProjectAccess('query', 'project_id'), verifyGuestViewAccess('query', 'project_id', 'roadmap'), safeControllerFunction(GanttController.getRoadmapTasks));
ganttApiRouter.get("/project-phases", verifyProjectAccess('query', 'project_id'), verifyGuestViewAccess('query', 'project_id', 'roadmap'), safeControllerFunction(GanttController.getProjectPhases));
ganttApiRouter.post("/update-task-dates", verifyNonGuestTaskAccess('body', 'task_id'), safeControllerFunction(GanttController.updateTaskDates));
ganttApiRouter.post("/create-task", verifyNonGuestProjectAccess('body', 'project_id'), safeControllerFunction(GanttController.createTask));
ganttApiRouter.post("/create-phase", requirePhases, safeControllerFunction(GanttController.createPhase));
ganttApiRouter.put("/update-phase", requirePhases, safeControllerFunction(GanttController.updatePhase));
ganttApiRouter.post("/reorder-phases", requirePhases, safeControllerFunction(GanttController.reorderPhases));

export default ganttApiRouter;
