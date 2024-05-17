import express from "express";

import SubTasksController from "../../controllers/sub-tasks-controller";

import idParamValidator from "../../middlewares/validators/id-param-validator";
import safeControllerFunction from "../../shared/safe-controller-function";

const subTasksApiRouter = express.Router();

subTasksApiRouter.get("/names/:id", idParamValidator, safeControllerFunction(SubTasksController.getNames)); // :id = parent task id
subTasksApiRouter.post("/roadmap/:id", idParamValidator, safeControllerFunction(SubTasksController.getSubTasksRoadMap)); // :id = parent task id
subTasksApiRouter.get("/:id", idParamValidator, safeControllerFunction(SubTasksController.get)); // :id = parent task id

export default subTasksApiRouter;
