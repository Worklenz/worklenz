import express from "express";

import HomePageController from "../../controllers/home-page-controller";
import safeControllerFunction from "../../shared/safe-controller-function";

const homePageApiRouter = express.Router();

homePageApiRouter.post("/personal-task", safeControllerFunction(HomePageController.createPersonalTask));
homePageApiRouter.get("/tasks", safeControllerFunction(HomePageController.getTasks));
homePageApiRouter.get("/tasks/filter-options", safeControllerFunction(HomePageController.getTaskFilterOptions));
homePageApiRouter.get("/unassigned-tasks", safeControllerFunction(HomePageController.getUnassignedTasks));
homePageApiRouter.get("/task-stats", safeControllerFunction(HomePageController.getTaskStats));
homePageApiRouter.get("/my-progress", safeControllerFunction(HomePageController.getMyProgress));
homePageApiRouter.get("/task-counts", safeControllerFunction(HomePageController.getTaskCountsByMonth));
homePageApiRouter.get("/tasks-by-date-range", safeControllerFunction(HomePageController.getTasksByDateRange));
homePageApiRouter.get("/personal-tasks", safeControllerFunction(HomePageController.getPersonalTasks));
homePageApiRouter.get("/projects", safeControllerFunction(HomePageController.getProjects));
homePageApiRouter.get("/team-projects", safeControllerFunction(HomePageController.getProjectsByTeam));
homePageApiRouter.put("/update-personal-task", safeControllerFunction(HomePageController.updatePersonalTask));

export default homePageApiRouter;
