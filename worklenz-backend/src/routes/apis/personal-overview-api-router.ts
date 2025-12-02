import express from "express";

import PersonalOverviewController from "../../controllers/personal-overview-controller";
import safeControllerFunction from "../../shared/safe-controller-function";

const personalOverviewApiRouter = express.Router();

personalOverviewApiRouter.get("/tasks-due-today", safeControllerFunction(PersonalOverviewController.getTasksDueToday));
personalOverviewApiRouter.get("/tasks-remaining", safeControllerFunction(PersonalOverviewController.getTasksRemaining));
personalOverviewApiRouter.get("/tasks-overview", safeControllerFunction(PersonalOverviewController.getTaskOverview));
personalOverviewApiRouter.get("/completed-tasks-today-percentage", safeControllerFunction(PersonalOverviewController.getCompletedTasksTodayPercentage));

export default personalOverviewApiRouter;
