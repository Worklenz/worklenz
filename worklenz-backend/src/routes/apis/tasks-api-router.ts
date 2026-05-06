import express, {Request, Response} from "express";

import TasksController from "../../controllers/tasks-controller";

import ganttTasksQueryParamsValidator from "../../middlewares/validators/gantt-tasks-query-params-validator";
import ganttTasksRangeParamsValidator from "../../middlewares/validators/gantt-tasks-range-params-validator";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import kanbanStatusUpdateValidator from "../../middlewares/validators/kanban-status-update-validator";
import tasksBodyValidator from "../../middlewares/validators/tasks-body-validator";
import quickTaskBodyValidator from "../../middlewares/validators/quick-task-validator";
import bulkTasksStatusValidator from "../../middlewares/validators/bulk-tasks-status-validator";
import bulkTasksPriorityValidator from "../../middlewares/validators/bulk-tasks-priority-validators";
import bulkTasksPhaseValidator from "../../middlewares/validators/bulk-tasks-phase-validators";
import bulkTasksValidator from "../../middlewares/validators/bulk-tasks-validator";
import bulkTasksDueDateValidator from "../../middlewares/validators/bulk-tasks-due-date-validator";
import mapTasksToBulkUpdate from "../../middlewares/map-tasks-to-bulk-update";
import homeTaskBodyValidator from "../../middlewares/validators/home-task-body-validator";
import TaskListColumnsController from "../../controllers/task-list-columns-controller";
import safeControllerFunction from "../../shared/safe-controller-function";
import taskCreateBodyValidator from "../../middlewares/validators/task-create-body--validator";
import verifyTaskAccess, {verifyBulkTaskAccessMiddleware} from "../../middlewares/verify-task-access";
import TasksControllerV2 from "../../controllers/tasks-controller-v2";
import verifyProjectAccess from "../../middlewares/verify-project-access";

const tasksApiRouter = express.Router();

// split the controller between the counts query and the original data query
function getList(req: Request, res: Response) {
  if (TasksControllerV2.isTasksOnlyReq(req.query))
    return TasksControllerV2.getTasksOnly(req, res);
  return TasksControllerV2.getList(req, res);
}

tasksApiRouter.post("/", taskCreateBodyValidator, safeControllerFunction(TasksController.create));
tasksApiRouter.get("/project/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(TasksController.getTasksByProject));
tasksApiRouter.get("/roadmap", ganttTasksQueryParamsValidator, safeControllerFunction(TasksController.getGanttTasksByProject));
tasksApiRouter.get("/range", ganttTasksRangeParamsValidator, safeControllerFunction(TasksController.getTasksBetweenRange));
tasksApiRouter.get("/project/selected-tasks/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(TasksController.getSelectedTasksByProject));
tasksApiRouter.get("/project/unselected-tasks/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(TasksController.getUnselectedTasksByProject));
tasksApiRouter.get("/team", safeControllerFunction(TasksController.getProjectTasksByTeam));
tasksApiRouter.get("/info", verifyTaskAccess('query', 'task_id'), safeControllerFunction(TasksController.getById));
tasksApiRouter.post("/convert", verifyTaskAccess('body', 'id'), safeControllerFunction(TasksControllerV2.convertToTask));
tasksApiRouter.get("/kanban/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(TasksController.getProjectTasksByStatus));
tasksApiRouter.get("/list/columns/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(TaskListColumnsController.getProjectTaskListColumns));
tasksApiRouter.put("/list/columns/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(TaskListColumnsController.toggleColumn));

tasksApiRouter.get("/list/v2/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(getList));
tasksApiRouter.get("/list/v3/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(TasksControllerV2.getTasksV3));
tasksApiRouter.post("/refresh-progress/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(TasksControllerV2.refreshTaskProgress));
tasksApiRouter.get("/progress-status/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(TasksControllerV2.getTaskProgressStatus));
tasksApiRouter.get("/assignees/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(TasksController.getProjectTaskAssignees));

tasksApiRouter.put("/bulk/status", verifyBulkTaskAccessMiddleware(), mapTasksToBulkUpdate, bulkTasksStatusValidator, safeControllerFunction(TasksController.bulkChangeStatus));
tasksApiRouter.put("/bulk/priority", verifyBulkTaskAccessMiddleware(), mapTasksToBulkUpdate, bulkTasksPriorityValidator, safeControllerFunction(TasksController.bulkChangePriority));
tasksApiRouter.put("/bulk/phase", verifyBulkTaskAccessMiddleware(), mapTasksToBulkUpdate, bulkTasksPhaseValidator, safeControllerFunction(TasksController.bulkChangePhase));

tasksApiRouter.put("/bulk/delete", verifyBulkTaskAccessMiddleware(), mapTasksToBulkUpdate, bulkTasksValidator, safeControllerFunction(TasksController.bulkDelete));
tasksApiRouter.put("/bulk/archive", verifyBulkTaskAccessMiddleware(), mapTasksToBulkUpdate, bulkTasksValidator, safeControllerFunction(TasksController.bulkArchive));
tasksApiRouter.put("/bulk/assign-me", verifyBulkTaskAccessMiddleware(), mapTasksToBulkUpdate, bulkTasksValidator, safeControllerFunction(TasksController.bulkAssignMe));
tasksApiRouter.put("/bulk/label", verifyBulkTaskAccessMiddleware(), mapTasksToBulkUpdate, bulkTasksValidator, safeControllerFunction(TasksController.bulkAssignLabel));
tasksApiRouter.put("/bulk/members", verifyBulkTaskAccessMiddleware(), mapTasksToBulkUpdate, bulkTasksValidator, safeControllerFunction(TasksController.bulkAssignMembers));
tasksApiRouter.put("/bulk/due-date", verifyBulkTaskAccessMiddleware(), mapTasksToBulkUpdate, bulkTasksDueDateValidator, safeControllerFunction(TasksController.bulkChangeDueDate));
tasksApiRouter.put("/bulk/start-date", verifyBulkTaskAccessMiddleware(), mapTasksToBulkUpdate, bulkTasksDueDateValidator, safeControllerFunction(TasksController.bulkChangeStartDate));
tasksApiRouter.put("/duration/:id", verifyTaskAccess('params', 'id'), safeControllerFunction(TasksController.updateDuration));
tasksApiRouter.put("/status/:status_id/:task_id", kanbanStatusUpdateValidator, verifyTaskAccess('params', 'task_id'), safeControllerFunction(TasksController.updateStatus));
tasksApiRouter.put("/:id", idParamValidator, tasksBodyValidator, verifyTaskAccess('params', 'id'), safeControllerFunction(TasksController.update));
tasksApiRouter.delete("/:id", verifyTaskAccess('params', 'id'), safeControllerFunction(TasksController.deleteById));
tasksApiRouter.post("/quick-task", quickTaskBodyValidator, safeControllerFunction(TasksController.createQuickTask));
tasksApiRouter.post("/home-task", homeTaskBodyValidator, safeControllerFunction(TasksController.createHomeTask));
tasksApiRouter.post("/convert-to-subtask", verifyTaskAccess('body', 'id'), safeControllerFunction(TasksControllerV2.convertToSubtask));
tasksApiRouter.get("/subscribers/:id", verifyTaskAccess('params', 'id'), safeControllerFunction(TasksControllerV2.getSubscribers));
tasksApiRouter.get("/search", verifyProjectAccess('query', 'projectId'), safeControllerFunction(TasksControllerV2.searchTasks));
tasksApiRouter.get("/dependency-status", verifyTaskAccess('query', 'taskId'), safeControllerFunction(TasksControllerV2.getTaskDependencyStatus));

tasksApiRouter.put("/labels/:id", idParamValidator, verifyTaskAccess('params', 'id'), safeControllerFunction(TasksControllerV2.assignLabelsToTask));

// Add custom column value update route
tasksApiRouter.put("/:taskId/custom-column", verifyTaskAccess('params', 'taskId'), TasksControllerV2.updateCustomColumnValue);

export default tasksApiRouter;
