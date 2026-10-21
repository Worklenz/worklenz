import express from "express";

import TaskWorklogController from "../../controllers/task-work-log-controller";
import idParamValidator from "../../middlewares/validators/id-param-validator";

import taskTimeLogValidator from "../../middlewares/validators/task-time-log-validator";
import timeEntriesPreferenceValidator from "../../middlewares/validators/time-entries-preference-validator";
import timeEntryUpdateValidator from "../../middlewares/validators/time-entry-update-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import verifyTaskAccess, {verifyTaskAccessViaWorkLog} from "../../middlewares/verify-task-access";
import verifyNonGuestTimeEntriesAccess from "../../middlewares/verify-non-guest-time-entries-access";

const taskWorkLogApiRouter = express.Router();

taskWorkLogApiRouter.post("/", taskTimeLogValidator, verifyTaskAccess('body', 'id'), safeControllerFunction(TaskWorklogController.create));
taskWorkLogApiRouter.get("/task/:id", idParamValidator, verifyTaskAccess('params', 'id'), safeControllerFunction(TaskWorklogController.getByTask));
taskWorkLogApiRouter.get("/export/:id", idParamValidator, verifyTaskAccess('params', 'id'), safeControllerFunction(TaskWorklogController.exportLog));
// Must stay ABOVE the parametric `PUT /:id` below: Express matches in declaration order,
// so declared after it, "my-preferences" is captured as a work-log id and the request is run
// through taskTimeLogValidator (which answers a bare 400) - preferences could never be saved.
taskWorkLogApiRouter.put("/my-preferences", verifyNonGuestTimeEntriesAccess, timeEntriesPreferenceValidator, safeControllerFunction(TaskWorklogController.updateMyPreferences));

taskWorkLogApiRouter.put("/:id", taskTimeLogValidator, idParamValidator, verifyTaskAccessViaWorkLog('params', 'id'), safeControllerFunction(TaskWorklogController.update));
// Time Entries page ONLY: edit/delete a time log, where owners/admins may also change other
// members' entries (see TaskWorklogController.updateTimeEntry). The task drawer keeps using the
// author-only `PUT|DELETE /:id` routes below, which are intentionally unchanged.
taskWorkLogApiRouter.put("/entries/:id", verifyNonGuestTimeEntriesAccess, idParamValidator, timeEntryUpdateValidator, verifyTaskAccessViaWorkLog('params', 'id'), safeControllerFunction(TaskWorklogController.updateTimeEntry));
taskWorkLogApiRouter.delete("/entries/:id", verifyNonGuestTimeEntriesAccess, idParamValidator, verifyTaskAccessViaWorkLog('params', 'id'), safeControllerFunction(TaskWorklogController.deleteTimeEntry));

taskWorkLogApiRouter.delete("/:id", idParamValidator, verifyTaskAccessViaWorkLog('params', 'id'), safeControllerFunction(TaskWorklogController.deleteById));

// Time Entries page reads — blocked for guests team-wide (this page isn't
// scoped to a single project, so the per-project guest check doesn't apply).
taskWorkLogApiRouter.get("/my-tasks", verifyNonGuestTimeEntriesAccess, safeControllerFunction(TaskWorklogController.getMyTasksWithLogs));
taskWorkLogApiRouter.get("/my-summary", verifyNonGuestTimeEntriesAccess, safeControllerFunction(TaskWorklogController.getMySummary));
taskWorkLogApiRouter.get("/my-weekly-breakdown", verifyNonGuestTimeEntriesAccess, safeControllerFunction(TaskWorklogController.getMyWeeklyBreakdown));
taskWorkLogApiRouter.get("/my-recent-projects", verifyNonGuestTimeEntriesAccess, safeControllerFunction(TaskWorklogController.getMyRecentProjects));
taskWorkLogApiRouter.get("/my-tasks-in-project", verifyNonGuestTimeEntriesAccess, safeControllerFunction(TaskWorklogController.getMyTasksInProject));
taskWorkLogApiRouter.get("/my-time-log-entries", verifyNonGuestTimeEntriesAccess, safeControllerFunction(TaskWorklogController.getMyTimeLogEntries));
taskWorkLogApiRouter.get("/my-grouped-entries", verifyNonGuestTimeEntriesAccess, safeControllerFunction(TaskWorklogController.getMyGroupedEntries));
taskWorkLogApiRouter.get("/my-context", verifyNonGuestTimeEntriesAccess, safeControllerFunction(TaskWorklogController.getMyContext));
taskWorkLogApiRouter.get("/my-filter-options", verifyNonGuestTimeEntriesAccess, safeControllerFunction(TaskWorklogController.getMyFilterOptions));
taskWorkLogApiRouter.get("/export-csv", verifyNonGuestTimeEntriesAccess, safeControllerFunction(TaskWorklogController.exportMyTimeLogEntriesCsv));

taskWorkLogApiRouter.get("/running-timers", safeControllerFunction(TaskWorklogController.getAllRunningTimers));
taskWorkLogApiRouter.get("/recent-logs", safeControllerFunction(TaskWorklogController.getRecentTimeLogs));

export default taskWorkLogApiRouter;
