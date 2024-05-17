import express from "express";

import HomePageController from "../../controllers/home-page-controller";
import safeControllerFunction from "../../shared/safe-controller-function";

const homePageApiRouter = express.Router();

homePageApiRouter.post("/personal-task", safeControllerFunction(HomePageController.createPersonalTask));
homePageApiRouter.get("/tasks", safeControllerFunction(HomePageController.getTasks));
homePageApiRouter.get("/personal-tasks", safeControllerFunction(HomePageController.getPersonalTasks));
homePageApiRouter.get("/projects", safeControllerFunction(HomePageController.getProjects));
homePageApiRouter.get("/team-projects", safeControllerFunction(HomePageController.getProjectsByTeam));
homePageApiRouter.put("/update-personal-task", safeControllerFunction(HomePageController.updatePersonalTask));

export default homePageApiRouter;
