import express from "express";

import TaskDuplicateController from "../../controllers/task-duplicate-controller";

import taskDuplicateBodyValidator from "../../middlewares/validators/task-duplicate-body-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import {verifyNonGuestTaskAccess} from "../../middlewares/verify-task-access";
import {PROJECT_ROLE_PERMISSIONS} from "../../shared/organization-permissions";

const taskDuplicateApiRouter = express.Router();

taskDuplicateApiRouter.post("/compare", verifyNonGuestTaskAccess('body', 'task_id'), safeControllerFunction(TaskDuplicateController.compare));
taskDuplicateApiRouter.post("/duplicate", taskDuplicateBodyValidator, verifyNonGuestTaskAccess('body', 'task_id', PROJECT_ROLE_PERMISSIONS.CREATE_TASKS), safeControllerFunction(TaskDuplicateController.duplicate));

export default taskDuplicateApiRouter;
