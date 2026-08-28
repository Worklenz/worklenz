import express from "express";

import TaskDuplicateController from "../../controllers/task-duplicate-controller";

import taskDuplicateBodyValidator from "../../middlewares/validators/task-duplicate-body-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import {verifyNonGuestTaskAccess} from "../../middlewares/verify-task-access";

const taskDuplicateApiRouter = express.Router();

taskDuplicateApiRouter.post("/duplicate", taskDuplicateBodyValidator, verifyNonGuestTaskAccess('body', 'task_id'), safeControllerFunction(TaskDuplicateController.duplicate));

export default taskDuplicateApiRouter;
