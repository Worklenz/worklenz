import express from "express";

import TaskDuplicateController from "../../controllers/task-duplicate-controller";

import taskDuplicateBodyValidator from "../../middlewares/validators/task-duplicate-body-validator";
import safeControllerFunction from "../../shared/safe-controller-function";

const taskDuplicateApiRouter = express.Router();

taskDuplicateApiRouter.post("/duplicate", taskDuplicateBodyValidator, safeControllerFunction(TaskDuplicateController.duplicate));

export default taskDuplicateApiRouter;
