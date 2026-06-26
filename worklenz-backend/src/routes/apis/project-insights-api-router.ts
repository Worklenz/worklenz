import express from "express";

import ProjectInsightsController from "../../controllers/project-insights-controller";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import verifyProjectAccess from "../../middlewares/verify-project-access";

const projectInsightsApiRouter = express.Router();

projectInsightsApiRouter.get("/last-updated/:id/:limit/:offset", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(ProjectInsightsController.getLastUpdatedtasks));
projectInsightsApiRouter.get("/last-updated/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(ProjectInsightsController.getLastUpdatedtasks));
projectInsightsApiRouter.get("/logs/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(ProjectInsightsController.getProjectLogs));
projectInsightsApiRouter.get("/status-overview/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(ProjectInsightsController.getStatusOverview));
projectInsightsApiRouter.get("/priority-overview/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(ProjectInsightsController.getPriorityOverview));
projectInsightsApiRouter.get("/deadline/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(ProjectInsightsController.getProjectDeadlineStats));

projectInsightsApiRouter.get("/members/stats/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(ProjectInsightsController.getMemberInsightsByProjectId));
projectInsightsApiRouter.post("/members/tasks", verifyProjectAccess('body', 'project_id'), safeControllerFunction(ProjectInsightsController.getTasksByProjectMember));

projectInsightsApiRouter.get("/overdue-tasks/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(ProjectInsightsController.getOverdueTasks));
projectInsightsApiRouter.get("/early-tasks/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(ProjectInsightsController.getTasksFinishedEarly));
projectInsightsApiRouter.get("/late-tasks/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(ProjectInsightsController.getTasksFinishedLate));

projectInsightsApiRouter.get("/overlogged-tasks/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(ProjectInsightsController.getOverloggedTasksByProject));

projectInsightsApiRouter.get("/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(ProjectInsightsController.getById));

export default projectInsightsApiRouter;
