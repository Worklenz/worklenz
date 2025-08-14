import express from "express";

import GanttController from "../../controllers/gantt-controller";
import safeControllerFunction from "../../shared/safe-controller-function";

const ganttApiRouter = express.Router();

ganttApiRouter.get("/project-phase-label", safeControllerFunction(GanttController.getPhaseLabel));

ganttApiRouter.get("/project-roadmap", safeControllerFunction(GanttController.get));
ganttApiRouter.get("/project-phases/:id", safeControllerFunction(GanttController.getPhasesByProject));

ganttApiRouter.get("/project-workload", safeControllerFunction(GanttController.getWorkload));

// New roadmap Gantt APIs
ganttApiRouter.get("/roadmap-tasks", safeControllerFunction(GanttController.getRoadmapTasks));
ganttApiRouter.get("/project-phases", safeControllerFunction(GanttController.getProjectPhases));
ganttApiRouter.post("/update-task-dates", safeControllerFunction(GanttController.updateTaskDates));
ganttApiRouter.post("/create-task", safeControllerFunction(GanttController.createTask));
ganttApiRouter.post("/create-phase", safeControllerFunction(GanttController.createPhase));
ganttApiRouter.put("/update-phase", safeControllerFunction(GanttController.updatePhase));

export default ganttApiRouter;