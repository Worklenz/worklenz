import express from "express";

import AccessControlsController from "../../controllers/access-controls-controller";
import AuthController from "../../controllers/auth-controller";
import LogsController from "../../controllers/logs-controller";
import OverviewController from "../../controllers/overview-controller";
import TaskPrioritiesController from "../../controllers/task-priorities-controller";

import attachmentsApiRouter from "./attachments-api-router";
import clientsApiRouter from "./clients-api-router";
import jobTitlesApiRouter from "./job-titles-api-router";
import notificationsApiRouter from "./notifications-api-router";
import personalOverviewApiRouter from "./personal-overview-api-router";
import projectMembersApiRouter from "./project-members-api-router";
import projectsApiRouter from "./projects-api-router";
import settingsApiRouter from "./settings-api-router";
import statusesApiRouter from "./statuses-api-router";
import subTasksApiRouter from "./sub-tasks-api-router";
import taskCommentsApiRouter from "./task-comments-api-router";
import taskWorkLogApiRouter from "./task-work-log-api-router";
import tasksApiRouter from "./tasks-api-router";
import teamMembersApiRouter from "./team-members-api-router";
import teamsApiRouter from "./teams-api-router";
import timezonesApiRouter from "./timezones-api-router";
import todoListApiRouter from "./todo-list-api-router";
import projectStatusesApiRouter from "./project-statuses-api-router";
import labelsApiRouter from "./labels-api-router";
import sharedProjectsApiRouter from "./shared-projects-api-router";
import resourceAllocationApiRouter from "./resource-allocation-api-router";
import taskTemplatesApiRouter from "./task-templates-api-router";
import projectInsightsApiRouter from "./project-insights-api-router";
import passwordValidator from "../../middlewares/validators/password-validator";
import adminCenterApiRouter from "./admin-center-api-router";
import reportingApiRouter from "./reporting-api-router";
import activityLogsApiRouter from "./activity-logs-api-router";
import safeControllerFunction from "../../shared/safe-controller-function";
import projectFoldersApiRouter from "./project-folders-api-router";
import taskPhasesApiRouter from "./task-phases-api-router";
import projectCategoriesApiRouter from "./project-categories-api-router";
import homePageApiRouter from "./home-page-api-router";
import ganttApiRouter from "./gantt-api-router";
import projectCommentsApiRouter from "./project-comments-api-router";
import reportingExportApiRouter from "./reporting-export-api-router";
import projectHealthsApiRouter from "./project-healths-api-router";
import ptTasksApiRouter from "./pt-tasks-api-router";
import projectTemplatesApiRouter from "./project-templates-api";
import ptTaskPhasesApiRouter from "./pt_task-phases-api-router";
import ptStatusesApiRouter from "./pt-statuses-api-router";
import workloadApiRouter from "./gannt-apis/workload-api-router";
import roadmapApiRouter from "./gannt-apis/roadmap-api-router";
import scheduleApiRouter from "./gannt-apis/schedule-api-router";
import scheduleApiV2Router from "./gannt-apis/schedule-api-v2-router";
import projectManagerApiRouter from "./project-managers-api-router";
import surveyApiRouter from "./survey-api-router";

import billingApiRouter from "./billing-api-router";
import taskDependenciesApiRouter from "./task-dependencies-api-router";

import taskRecurringApiRouter from "./task-recurring-api-router";

import customColumnsApiRouter from "./custom-columns-api-router";
import userActivityLogsApiRouter from "./user-activity-logs-api-router";
import supportApiRouter from "./support-api-router";
import accountApiRouter from "./account-api-router";

const api = express.Router();

api.use("/projects", projectsApiRouter);
api.use("/team-members", teamMembersApiRouter);
api.use("/job-titles", jobTitlesApiRouter);
api.use("/clients", clientsApiRouter);
api.use("/teams", teamsApiRouter);
api.use("/tasks", tasksApiRouter);
api.use("/settings", settingsApiRouter);
api.use("/personal-overview", personalOverviewApiRouter);
api.use("/statuses", statusesApiRouter);
api.use("/todo-list", todoListApiRouter);
api.use("/notifications", notificationsApiRouter);
api.use("/attachments", attachmentsApiRouter);
api.use("/sub-tasks", subTasksApiRouter);
api.use("/project-members", projectMembersApiRouter);
api.use("/task-time-log", taskWorkLogApiRouter);
api.use("/task-comments", taskCommentsApiRouter);
api.use("/timezones", timezonesApiRouter);
api.use("/project-statuses", projectStatusesApiRouter);
api.use("/labels", labelsApiRouter);
api.use("/resource-allocation", resourceAllocationApiRouter);
api.use("/shared/projects", sharedProjectsApiRouter);
api.use("/task-templates", taskTemplatesApiRouter);
api.use("/project-insights", projectInsightsApiRouter);
api.use("/admin-center", adminCenterApiRouter);
api.use("/reporting", reportingApiRouter);
api.use("/activity-logs", activityLogsApiRouter);
api.use("/projects-folders", projectFoldersApiRouter);
api.use("/task-phases", taskPhasesApiRouter);
api.use("/project-categories", projectCategoriesApiRouter);
api.use("/home", homePageApiRouter);
api.use("/gantt", ganttApiRouter);
api.use("/project-comments", projectCommentsApiRouter);
api.use("/reporting-export", reportingExportApiRouter);
api.use("/project-healths", projectHealthsApiRouter);
api.use("/project-templates", projectTemplatesApiRouter);
api.use("/pt-tasks", ptTasksApiRouter);
api.use("/pt-task-phases", ptTaskPhasesApiRouter);
api.use("/pt-statuses", ptStatusesApiRouter);
api.use("/workload-gannt", workloadApiRouter);
api.use("/roadmap-gannt", roadmapApiRouter);
api.use("/schedule-gannt", scheduleApiRouter);
api.use("/schedule-gannt-v2", scheduleApiV2Router);
api.use("/project-managers", projectManagerApiRouter);
api.use("/surveys", surveyApiRouter);

api.get("/overview/:id", safeControllerFunction(OverviewController.getById));
api.get("/task-priorities", safeControllerFunction(TaskPrioritiesController.get));
api.post("/change-password", passwordValidator, safeControllerFunction(AuthController.changePassword));
api.get("/access-controls/roles", safeControllerFunction(AccessControlsController.getRoles));
api.get("/logs/my-dashboard", safeControllerFunction(LogsController.getActivityLog));

api.use("/billing", billingApiRouter);
api.use("/task-dependencies", taskDependenciesApiRouter);

api.use("/task-recurring", taskRecurringApiRouter);

api.use("/custom-columns", customColumnsApiRouter);
api.use("/support", supportApiRouter);
api.use("/account", accountApiRouter);

api.use("/logs", userActivityLogsApiRouter);
export default api;
