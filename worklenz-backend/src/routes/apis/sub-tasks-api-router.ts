import express from "express";

import SubTasksController from "../../controllers/sub-tasks-controller";

import idParamValidator from "../../middlewares/validators/id-param-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import verifyTaskAccess from "../../middlewares/verify-task-access";

const subTasksApiRouter = express.Router();

subTasksApiRouter.get("/names/:id", idParamValidator, verifyTaskAccess('params', 'id'), safeControllerFunction(SubTasksController.getNames)); // :id = parent task id
subTasksApiRouter.post("/roadmap/:id", idParamValidator, verifyTaskAccess('params', 'id'), safeControllerFunction(SubTasksController.getSubTasksRoadMap)); // :id = parent task id
subTasksApiRouter.get("/:id", idParamValidator, verifyTaskAccess('params', 'id'), safeControllerFunction(SubTasksController.get)); // :id = parent task id

export default subTasksApiRouter;
