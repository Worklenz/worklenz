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
import mapTasksToBulkUpdate from "../../middlewares/map-tasks-to-bulk-update";
import homeTaskBodyValidator from "../../middlewares/validators/home-task-body-validator";
import TaskListColumnsController from "../../controllers/task-list-columns-controller";
import TasksControllerV2 from "../../controllers/tasks-controller-v2";
import safeControllerFunction from "../../shared/safe-controller-function";
import taskCreateBodyValidator from "../../middlewares/validators/task-create-body--validator";

const tasksApiRouter = express.Router();

// split the controller between the counts query and the original data query
function getList(req: Request, res: Response) {
  if (TasksControllerV2.isTasksOnlyReq(req.query))
    return TasksControllerV2.getTasksOnly(req, res);
  return TasksControllerV2.getList(req, res);
}

tasksApiRouter.post("/", taskCreateBodyValidator, safeControllerFunction(TasksController.create));
tasksApiRouter.get("/project/:id", idParamValidator, safeControllerFunction(TasksController.getTasksByProject));
tasksApiRouter.get("/roadmap", ganttTasksQueryParamsValidator, safeControllerFunction(TasksController.getGanttTasksByProject));
tasksApiRouter.get("/range", ganttTasksRangeParamsValidator, safeControllerFunction(TasksController.getTasksBetweenRange));
tasksApiRouter.get("/project/selected-tasks/:id", idParamValidator, safeControllerFunction(TasksController.getSelectedTasksByProject));
tasksApiRouter.get("/project/unselected-tasks/:id", idParamValidator, safeControllerFunction(TasksController.getUnselectedTasksByProject));
tasksApiRouter.get("/team", safeControllerFunction(TasksController.getProjectTasksByTeam));
tasksApiRouter.get("/info", safeControllerFunction(TasksController.getById));
tasksApiRouter.post("/convert", safeControllerFunction(TasksControllerV2.convertToTask));
tasksApiRouter.get("/kanban/:id", safeControllerFunction(TasksController.getProjectTasksByStatus));
tasksApiRouter.get("/list/columns/:id", idParamValidator, safeControllerFunction(TaskListColumnsController.getProjectTaskListColumns));
tasksApiRouter.put("/list/columns/:id", idParamValidator, safeControllerFunction(TaskListColumnsController.toggleColumn));

tasksApiRouter.get("/list/v2/:id", idParamValidator, safeControllerFunction(getList));
tasksApiRouter.get("/list/v3/:id", idParamValidator, safeControllerFunction(TasksControllerV2.getTasksV3));
tasksApiRouter.post("/refresh-progress/:id", idParamValidator, safeControllerFunction(TasksControllerV2.refreshTaskProgress));
tasksApiRouter.get("/progress-status/:id", idParamValidator, safeControllerFunction(TasksControllerV2.getTaskProgressStatus));
tasksApiRouter.get("/assignees/:id", idParamValidator, safeControllerFunction(TasksController.getProjectTaskAssignees));

tasksApiRouter.put("/bulk/status", mapTasksToBulkUpdate, bulkTasksStatusValidator, safeControllerFunction(TasksController.bulkChangeStatus));
tasksApiRouter.put("/bulk/priority", mapTasksToBulkUpdate, bulkTasksPriorityValidator, safeControllerFunction(TasksController.bulkChangePriority));
tasksApiRouter.put("/bulk/phase", mapTasksToBulkUpdate, bulkTasksPhaseValidator, safeControllerFunction(TasksController.bulkChangePhase));

tasksApiRouter.put("/bulk/delete", mapTasksToBulkUpdate, bulkTasksValidator, safeControllerFunction(TasksController.bulkDelete));
tasksApiRouter.put("/bulk/archive", mapTasksToBulkUpdate, bulkTasksValidator, safeControllerFunction(TasksController.bulkArchive));
tasksApiRouter.put("/bulk/assign-me", mapTasksToBulkUpdate, bulkTasksValidator, safeControllerFunction(TasksController.bulkAssignMe));
tasksApiRouter.put("/bulk/label", mapTasksToBulkUpdate, bulkTasksValidator, safeControllerFunction(TasksController.bulkAssignLabel));
tasksApiRouter.put("/bulk/members", mapTasksToBulkUpdate, bulkTasksValidator, safeControllerFunction(TasksController.bulkAssignMembers));
tasksApiRouter.put("/duration/:id", safeControllerFunction(TasksController.updateDuration));
tasksApiRouter.put("/status/:status_id/:task_id", kanbanStatusUpdateValidator, safeControllerFunction(TasksController.updateStatus));
tasksApiRouter.put("/:id", idParamValidator, tasksBodyValidator, safeControllerFunction(TasksController.update));
tasksApiRouter.delete("/:id", safeControllerFunction(TasksController.deleteById));
tasksApiRouter.post("/quick-task", quickTaskBodyValidator, safeControllerFunction(TasksController.createQuickTask));
tasksApiRouter.post("/home-task", homeTaskBodyValidator, safeControllerFunction(TasksController.createHomeTask));
tasksApiRouter.post("/convert-to-subtask", safeControllerFunction(TasksControllerV2.convertToSubtask));
tasksApiRouter.get("/subscribers/:id", safeControllerFunction(TasksControllerV2.getSubscribers));
tasksApiRouter.get("/search", safeControllerFunction(TasksControllerV2.searchTasks));
tasksApiRouter.get("/dependency-status", safeControllerFunction(TasksControllerV2.getTaskDependencyStatus));

tasksApiRouter.put("/labels/:id", idParamValidator, safeControllerFunction(TasksControllerV2.assignLabelsToTask));

// Add custom column value update route
tasksApiRouter.put("/:taskId/custom-column", TasksControllerV2.updateCustomColumnValue);

export default tasksApiRouter;
