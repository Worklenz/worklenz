import express from "express";

import TaskdependenciesController from "../../controllers/task-dependencies-controller";
import verifyTaskAccess, {verifyTaskAccessViaDependency, verifyTaskRolePermission} from "../../middlewares/verify-task-access";
import { PROJECT_ROLE_PERMISSIONS } from "../../shared/organization-permissions";

const taskDependenciesApiRouter = express.Router();

taskDependenciesApiRouter.post("/", verifyTaskAccess('body', 'task_id'), verifyTaskRolePermission('body', 'task_id', PROJECT_ROLE_PERMISSIONS.EDIT_TASKS), TaskdependenciesController.saveTaskDependency);
taskDependenciesApiRouter.get("/:id", verifyTaskAccess('params', 'id'), TaskdependenciesController.getTaskDependencies);
taskDependenciesApiRouter.delete("/:id", verifyTaskAccessViaDependency('params', 'id'), TaskdependenciesController.deleteById);

export default taskDependenciesApiRouter;
