import express from "express";
import safeControllerFunction from "../../shared/safe-controller-function";
import ReportingOverviewExportController from "../../controllers/reporting/overview/reporting-overview-export-controller";
import ReportingAllocationController from "../../controllers/reporting/reporting-allocation-controller";
import ReportingProjectsExportController from "../../controllers/reporting/projects/reporting-projects-export-controller";
import ReportingMembersController from "../../controllers/reporting/reporting-members-controller";

const reportingExportApiRouter = express.Router();

reportingExportApiRouter.get("/overview/projects", safeControllerFunction(ReportingOverviewExportController.getProjectsByTeamOrMember));
reportingExportApiRouter.get("/overview/members", safeControllerFunction(ReportingOverviewExportController.getMembersByTeam));
reportingExportApiRouter.get("/allocation/export", safeControllerFunction(ReportingAllocationController.export));
reportingExportApiRouter.get("/projects/export", safeControllerFunction(ReportingProjectsExportController.export));
reportingExportApiRouter.get("/projects-time-log-breakdown/export", safeControllerFunction(ReportingProjectsExportController.exportProjectTimeLogs));
reportingExportApiRouter.get("/members/export", safeControllerFunction(ReportingMembersController.export));
reportingExportApiRouter.get("/project-members/export", safeControllerFunction(ReportingOverviewExportController.exportProjectMembers));
reportingExportApiRouter.get("/project-tasks/export", safeControllerFunction(ReportingOverviewExportController.exportProjectTasks));
reportingExportApiRouter.get("/member-projects/export", safeControllerFunction(ReportingMembersController.exportMemberProjects));
reportingExportApiRouter.get("/member-tasks/export", safeControllerFunction(ReportingOverviewExportController.exportMemberTasks));
reportingExportApiRouter.get("/flat-tasks/export", safeControllerFunction(ReportingOverviewExportController.exportFlatTasks));
reportingExportApiRouter.get("/member-time-log-breakdown/export", safeControllerFunction(ReportingMembersController.exportTimeLogs));
reportingExportApiRouter.get("/member-activity-log-breakdown/export", safeControllerFunction(ReportingMembersController.exportActivityLogs));

export default reportingExportApiRouter;
