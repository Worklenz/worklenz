import express from "express";

import TaskWorklogController from "../../controllers/task-work-log-controller";
import idParamValidator from "../../middlewares/validators/id-param-validator";

import taskTimeLogValidator from "../../middlewares/validators/task-time-log-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import { roundToNearest15Min, PPM_TIME_INCREMENT } from "../../ppm/utils/time-rounding"; // PPM-OVERRIDE: 15-min increment enforcement

// PPM-OVERRIDE: Middleware to round time entries to 15-min increments
const ppmRoundTimeIncrement = (req: express.Request, _res: express.Response, next: express.NextFunction) => {
  if (req.body && typeof req.body.seconds_spent === "number") {
    req.body.seconds_spent = roundToNearest15Min(req.body.seconds_spent);
  }
  next();
};

const taskWorkLogApiRouter = express.Router();

taskWorkLogApiRouter.post("/", taskTimeLogValidator, ppmRoundTimeIncrement, safeControllerFunction(TaskWorklogController.create));
taskWorkLogApiRouter.get("/task/:id", idParamValidator, safeControllerFunction(TaskWorklogController.getByTask));
taskWorkLogApiRouter.get("/export/:id", idParamValidator, safeControllerFunction(TaskWorklogController.exportLog));
taskWorkLogApiRouter.put("/:id", taskTimeLogValidator, idParamValidator, ppmRoundTimeIncrement, safeControllerFunction(TaskWorklogController.update));
taskWorkLogApiRouter.delete("/:id", idParamValidator, safeControllerFunction(TaskWorklogController.deleteById));
taskWorkLogApiRouter.get("/running-timers", safeControllerFunction(TaskWorklogController.getAllRunningTimers));

export default taskWorkLogApiRouter;
