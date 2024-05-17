import express from "express";

import ProjectInsightsController from "../../controllers/project-insights-controller";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import safeControllerFunction from "../../shared/safe-controller-function";

const projectInsightsApiRouter = express.Router();

projectInsightsApiRouter.get("/last-updated/:id", idParamValidator, safeControllerFunction(ProjectInsightsController.getLastUpdatedtasks));
projectInsightsApiRouter.get("/logs/:id", idParamValidator, safeControllerFunction(ProjectInsightsController.getProjectLogs));
projectInsightsApiRouter.get("/status-overview/:id", idParamValidator, safeControllerFunction(ProjectInsightsController.getStatusOverview));
projectInsightsApiRouter.get("/priority-overview/:id", idParamValidator, safeControllerFunction(ProjectInsightsController.getPriorityOverview));
projectInsightsApiRouter.get("/deadline/:id", idParamValidator, safeControllerFunction(ProjectInsightsController.getProjectDeadlineStats));

projectInsightsApiRouter.get("/members/stats/:id", idParamValidator, safeControllerFunction(ProjectInsightsController.getMemberInsightsByProjectId));
projectInsightsApiRouter.post("/members/tasks", safeControllerFunction(ProjectInsightsController.getTasksByProjectMember));

projectInsightsApiRouter.get("/overdue-tasks/:id", idParamValidator, safeControllerFunction(ProjectInsightsController.getOverdueTasks));
projectInsightsApiRouter.get("/early-tasks/:id", idParamValidator, safeControllerFunction(ProjectInsightsController.getTasksFinishedEarly));
projectInsightsApiRouter.get("/late-tasks/:id", idParamValidator, safeControllerFunction(ProjectInsightsController.getTasksFinishedLate));

projectInsightsApiRouter.get("/overlogged-tasks/:id", idParamValidator, safeControllerFunction(ProjectInsightsController.getOverloggedTasksByProject));

projectInsightsApiRouter.get("/:id", idParamValidator, safeControllerFunction(ProjectInsightsController.getById));

export default projectInsightsApiRouter;
