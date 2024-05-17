import express from "express";

import ActivitylogsController from "../../controllers/activity-logs-controller";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import safeControllerFunction from "../../shared/safe-controller-function";

const activityLogsApiRouter = express.Router();

activityLogsApiRouter.get("/:id", idParamValidator, safeControllerFunction(ActivitylogsController.get));

export default activityLogsApiRouter;
