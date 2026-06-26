import express from "express";

import TaskdependenciesController from "../../controllers/task-dependencies-controller";
import verifyTaskAccess, {verifyTaskAccessViaDependency} from "../../middlewares/verify-task-access";

const taskDependenciesApiRouter = express.Router();

taskDependenciesApiRouter.post("/", verifyTaskAccess('body', 'task_id'), TaskdependenciesController.saveTaskDependency);
taskDependenciesApiRouter.get("/:id", verifyTaskAccess('params', 'id'), TaskdependenciesController.getTaskDependencies);
taskDependenciesApiRouter.delete("/:id", verifyTaskAccessViaDependency('params', 'id'), TaskdependenciesController.deleteById);

export default taskDependenciesApiRouter;