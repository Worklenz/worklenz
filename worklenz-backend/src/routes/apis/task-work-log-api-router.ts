import express from "express";

import TaskWorklogController from "../../controllers/task-work-log-controller";
import idParamValidator from "../../middlewares/validators/id-param-validator";

import taskTimeLogValidator from "../../middlewares/validators/task-time-log-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import verifyTaskAccess, {verifyTaskAccessViaWorkLog} from "../../middlewares/verify-task-access";

const taskWorkLogApiRouter = express.Router();

taskWorkLogApiRouter.post("/", taskTimeLogValidator, verifyTaskAccess('body', 'id'), safeControllerFunction(TaskWorklogController.create));
taskWorkLogApiRouter.get("/task/:id", idParamValidator, verifyTaskAccess('params', 'id'), safeControllerFunction(TaskWorklogController.getByTask));
taskWorkLogApiRouter.get("/export/:id", idParamValidator, verifyTaskAccess('params', 'id'), safeControllerFunction(TaskWorklogController.exportLog));
taskWorkLogApiRouter.put("/:id", taskTimeLogValidator, idParamValidator, verifyTaskAccessViaWorkLog('params', 'id'), safeControllerFunction(TaskWorklogController.update));
taskWorkLogApiRouter.delete("/:id", idParamValidator, verifyTaskAccessViaWorkLog('params', 'id'), safeControllerFunction(TaskWorklogController.deleteById));
taskWorkLogApiRouter.get("/my-tasks", safeControllerFunction(TaskWorklogController.getMyTasksWithLogs));
taskWorkLogApiRouter.get("/my-summary", safeControllerFunction(TaskWorklogController.getMySummary));
taskWorkLogApiRouter.get("/my-weekly-breakdown", safeControllerFunction(TaskWorklogController.getMyWeeklyBreakdown));
taskWorkLogApiRouter.get("/my-recent-projects", safeControllerFunction(TaskWorklogController.getMyRecentProjects));
taskWorkLogApiRouter.get("/my-tasks-in-project", safeControllerFunction(TaskWorklogController.getMyTasksInProject));
taskWorkLogApiRouter.get("/running-timers", safeControllerFunction(TaskWorklogController.getAllRunningTimers));
taskWorkLogApiRouter.get("/recent-logs", safeControllerFunction(TaskWorklogController.getRecentTimeLogs));
taskWorkLogApiRouter.get("/my-time-log-entries", safeControllerFunction(TaskWorklogController.getMyTimeLogEntries));

export default taskWorkLogApiRouter;
