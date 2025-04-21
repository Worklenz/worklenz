import express from "express";

import TaskdependenciesController from "../../controllers/task-dependencies-controller";

const taskDependenciesApiRouter = express.Router();

taskDependenciesApiRouter.post("/", TaskdependenciesController.saveTaskDependency);
taskDependenciesApiRouter.get("/:id", TaskdependenciesController.getTaskDependencies);
taskDependenciesApiRouter.delete("/:id", TaskdependenciesController.deleteById);

export default taskDependenciesApiRouter;