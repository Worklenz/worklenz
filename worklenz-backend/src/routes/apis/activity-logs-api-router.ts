import express from "express";

import ActivitylogsController from "../../controllers/activity-logs-controller";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import verifyTaskAccess from "../../middlewares/verify-task-access";

const activityLogsApiRouter = express.Router();

activityLogsApiRouter.get("/:id", idParamValidator, verifyTaskAccess("params", "id"), safeControllerFunction(ActivitylogsController.get));

export default activityLogsApiRouter;
