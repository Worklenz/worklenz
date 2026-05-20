import express from "express";
import safeControllerFunction from "../../shared/safe-controller-function";
import ReportingOverviewExportController from "../../controllers/reporting/overview/reporting-overview-export-controller";
import ReportingAllocationController from "../../controllers/reporting/reporting-allocation-controller";
import ReportingProjectsExportController from "../../controllers/reporting/projects/reporting-projects-export-controller";
import ReportingMembersController from "../../controllers/reporting/reporting-members-controller";
import teamOwnerOrAdminValidator from "../../middlewares/validators/team-owner-or-admin-validator";

const reportingExportApiRouter = express.Router();

reportingExportApiRouter.get("/overview/projects", teamOwnerOrAdminValidator, safeControllerFunction(ReportingOverviewExportController.getProjectsByTeamOrMember));
reportingExportApiRouter.get("/overview/members", teamOwnerOrAdminValidator, safeControllerFunction(ReportingOverviewExportController.getMembersByTeam));
reportingExportApiRouter.get("/allocation/export", teamOwnerOrAdminValidator, safeControllerFunction(ReportingAllocationController.export));
reportingExportApiRouter.get("/projects/export", teamOwnerOrAdminValidator, safeControllerFunction(ReportingProjectsExportController.export));
reportingExportApiRouter.get("/projects-time-log-breakdown/export", teamOwnerOrAdminValidator, safeControllerFunction(ReportingProjectsExportController.exportProjectTimeLogs));
reportingExportApiRouter.get("/members/export", teamOwnerOrAdminValidator, safeControllerFunction(ReportingMembersController.export));
reportingExportApiRouter.get("/project-members/export", teamOwnerOrAdminValidator, safeControllerFunction(ReportingOverviewExportController.exportProjectMembers));
reportingExportApiRouter.get("/project-tasks/export", teamOwnerOrAdminValidator, safeControllerFunction(ReportingOverviewExportController.exportProjectTasks));
reportingExportApiRouter.get("/project-member-tasks/export", teamOwnerOrAdminValidator, safeControllerFunction(ReportingOverviewExportController.exportProjectMemberTasks));
reportingExportApiRouter.get("/member-projects/export", teamOwnerOrAdminValidator, safeControllerFunction(ReportingMembersController.exportMemberProjects));
reportingExportApiRouter.get("/member-tasks/export", teamOwnerOrAdminValidator, safeControllerFunction(ReportingOverviewExportController.exportMemberTasks));
reportingExportApiRouter.get("/flat-tasks/export", teamOwnerOrAdminValidator, safeControllerFunction(ReportingOverviewExportController.exportFlatTasks));
reportingExportApiRouter.get("/member-time-log-breakdown/export", teamOwnerOrAdminValidator, safeControllerFunction(ReportingMembersController.exportTimeLogs));
reportingExportApiRouter.get("/member-activity-log-breakdown/export", teamOwnerOrAdminValidator, safeControllerFunction(ReportingMembersController.exportActivityLogs));
reportingExportApiRouter.get("/timelogs-flat/export-csv", teamOwnerOrAdminValidator, safeControllerFunction(ReportingMembersController.exportTimelogsFlatCSV));
reportingExportApiRouter.get("/timelogs-flat/export-excel", teamOwnerOrAdminValidator, safeControllerFunction(ReportingMembersController.exportTimelogsFlatExcel));

export default reportingExportApiRouter;
