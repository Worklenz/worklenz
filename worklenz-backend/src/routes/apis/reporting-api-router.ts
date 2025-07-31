import express from "express";

import ReportingController from "../../controllers/reporting-controller";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import ReportingOverviewController from "../../controllers/reporting/overview/reporting-overview-controller";
import ReportingInfoController from "../../controllers/reporting/reporting-info-controller";
import ReportingAllocationController from "../../controllers/reporting/reporting-allocation-controller";
import ReportingProjectsController from "../../controllers/reporting/projects/reporting-projects-controller";
import ReportingMembersController from "../../controllers/reporting/reporting-members-controller";

const reportingApiRouter = express.Router();

reportingApiRouter.get("/info", safeControllerFunction(ReportingInfoController.getInfo));

// Overview
reportingApiRouter.get("/overview/statistics", safeControllerFunction(ReportingOverviewController.getStatistics));
reportingApiRouter.get("/overview/teams", safeControllerFunction(ReportingOverviewController.getTeams));
reportingApiRouter.get("/overview/projects", safeControllerFunction(ReportingOverviewController.getProjects));
reportingApiRouter.get("/overview/projects/:team_id", safeControllerFunction(ReportingOverviewController.getProjectsByTeamOrMember));
reportingApiRouter.get("/overview/members/:team_id", safeControllerFunction(ReportingOverviewController.getMembersByTeam));
reportingApiRouter.get("/overview/team/info/:team_id", safeControllerFunction(ReportingOverviewController.getTeamOverview));

reportingApiRouter.get("/overview/project/info/:project_id", safeControllerFunction(ReportingOverviewController.getProjectOverview));
reportingApiRouter.get("/overview/project/members/:project_id", safeControllerFunction(ReportingOverviewController.getProjectMembers));
reportingApiRouter.get("/overview/project/tasks/:project_id", safeControllerFunction(ReportingOverviewController.getProjectTasks));

reportingApiRouter.get("/overview/member/info", safeControllerFunction(ReportingOverviewController.getMemberOverview));
reportingApiRouter.get("/overview/team-member/info", safeControllerFunction(ReportingOverviewController.getTeamMemberOverview));
reportingApiRouter.get("/overview/member/tasks/:team_member_id", safeControllerFunction(ReportingOverviewController.getMemberTasks));

// Projects
reportingApiRouter.get("/projects", safeControllerFunction(ReportingProjectsController.get));
reportingApiRouter.post("/project-timelogs", safeControllerFunction(ReportingProjectsController.getProjectTimeLogs));

// members
reportingApiRouter.get("/members", safeControllerFunction(ReportingMembersController.getReportingMembers));

reportingApiRouter.post("/members/all", safeControllerFunction(ReportingController.getReportingMembers));
reportingApiRouter.post("/projects-by-member", safeControllerFunction(ReportingController.getProjectsByMember));
reportingApiRouter.get("/members/unassigned", safeControllerFunction(ReportingController.getUnAssignedUsers));
reportingApiRouter.get("/members/overdue/:id", idParamValidator, safeControllerFunction(ReportingController.getMembersWithOverDueTasks));
reportingApiRouter.get("/member/stats/:id", idParamValidator, safeControllerFunction(ReportingController.getReportingMemberStats));
reportingApiRouter.get("/member/overview/:id", idParamValidator, safeControllerFunction(ReportingController.getReportingMemberOverview));
reportingApiRouter.get("/member/projects", safeControllerFunction(ReportingController.getMemberProjects));

reportingApiRouter.get("/member/project", safeControllerFunction(ReportingController.getTasksByProject));
reportingApiRouter.get("/member/tasks", safeControllerFunction(ReportingController.getReportingMembersTasks));


reportingApiRouter.post("/", safeControllerFunction(ReportingController.create));
reportingApiRouter.post("/actual-vs-estimate", safeControllerFunction(ReportingController.getEstimatedVsActualTime));
reportingApiRouter.post("/allocation", safeControllerFunction(ReportingAllocationController.getAllocation));
reportingApiRouter.get("/allocation/teams", safeControllerFunction(ReportingController.getMyTeams));
reportingApiRouter.post("/allocation/categories", safeControllerFunction(ReportingController.getCategoriesByTeams));
reportingApiRouter.post("/allocation/projects", safeControllerFunction(ReportingController.getProjectsByTeams));

reportingApiRouter.get("/overview/export", safeControllerFunction(ReportingController.exportOverviewExcel));
reportingApiRouter.get("/allocation/export", safeControllerFunction(ReportingController.exportAllocation));
reportingApiRouter.get("/projects/export", safeControllerFunction(ReportingController.exportProjects));
reportingApiRouter.get("/members/export", safeControllerFunction(ReportingController.exportMembers));
reportingApiRouter.get("/members/single-member-task-stats", safeControllerFunction(ReportingMembersController.getMemberTaskStats));
reportingApiRouter.get("/members/single-member-projects", safeControllerFunction(ReportingMembersController.getSingleMemberProjects));

reportingApiRouter.get("/member-projects", safeControllerFunction(ReportingMembersController.getMemberProjects));
reportingApiRouter.post("/members/single-member-activities", safeControllerFunction(ReportingMembersController.getMemberActivities));
reportingApiRouter.post("/members/single-member-timelogs", safeControllerFunction(ReportingMembersController.getMemberTimelogs));

reportingApiRouter.post("/time-reports/projects", safeControllerFunction(ReportingAllocationController.getProjectTimeSheets));
reportingApiRouter.post("/time-reports/members", safeControllerFunction(ReportingAllocationController.getMemberTimeSheets));
reportingApiRouter.post("/time-reports/estimated-vs-actual", safeControllerFunction(ReportingAllocationController.getEstimatedVsActual));

export default reportingApiRouter;
