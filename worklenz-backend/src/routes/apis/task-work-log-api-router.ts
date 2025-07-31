import express from "express";

import TaskWorklogController from "../../controllers/task-work-log-controller";
import idParamValidator from "../../middlewares/validators/id-param-validator";

import taskTimeLogValidator from "../../middlewares/validators/task-time-log-validator";
import safeControllerFunction from "../../shared/safe-controller-function";

const taskWorkLogApiRouter = express.Router();

taskWorkLogApiRouter.post("/", taskTimeLogValidator, safeControllerFunction(TaskWorklogController.create));
taskWorkLogApiRouter.get("/task/:id", idParamValidator, safeControllerFunction(TaskWorklogController.getByTask));
taskWorkLogApiRouter.get("/export/:id", idParamValidator, safeControllerFunction(TaskWorklogController.exportLog));
taskWorkLogApiRouter.put("/:id", taskTimeLogValidator, idParamValidator, safeControllerFunction(TaskWorklogController.update));
taskWorkLogApiRouter.delete("/:id", idParamValidator, safeControllerFunction(TaskWorklogController.deleteById));
taskWorkLogApiRouter.get("/running-timers", safeControllerFunction(TaskWorklogController.getAllRunningTimers));

export default taskWorkLogApiRouter;
