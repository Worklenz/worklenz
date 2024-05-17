import express from "express";

import ProjectCategoriesController from "../../controllers/project-categories-controller";
import safeControllerFunction from "../../shared/safe-controller-function";

const projectCategoriesApiRouter = express.Router();

projectCategoriesApiRouter.post("/", safeControllerFunction(ProjectCategoriesController.create));
projectCategoriesApiRouter.get("/", safeControllerFunction(ProjectCategoriesController.get));
projectCategoriesApiRouter.get("/org-categories", safeControllerFunction(ProjectCategoriesController.getByMultipleTeams));
projectCategoriesApiRouter.get("/:id", safeControllerFunction(ProjectCategoriesController.getById));
projectCategoriesApiRouter.put("/:id", safeControllerFunction(ProjectCategoriesController.update));
projectCategoriesApiRouter.delete("/:id", safeControllerFunction(ProjectCategoriesController.deleteById));

export default projectCategoriesApiRouter;
