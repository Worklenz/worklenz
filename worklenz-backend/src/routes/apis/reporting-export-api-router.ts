import express from "express";
import safeControllerFunction from "../../shared/safe-controller-function";
import ReportingOverviewExportController from "../../controllers/reporting/overview/reporting-overview-export-controller";
import ReportingAllocationController from "../../controllers/reporting/reporting-allocation-controller";
import ReportingProjectsExportController from "../../controllers/reporting/projects/reporting-projects-export-controller";
import ReportingMembersController from "../../controllers/reporting/reporting-members-controller";
import ReportingTimeLogsController from "../../controllers/reporting/reporting-time-logs-controller";
import { viewReportsValidator } from "../../middlewares/validators/organization-permission-validator";

const reportingExportApiRouter = express.Router();

reportingExportApiRouter.get("/overview/projects", viewReportsValidator, safeControllerFunction(ReportingOverviewExportController.getProjectsByTeamOrMember));
reportingExportApiRouter.get("/overview/members", viewReportsValidator, safeControllerFunction(ReportingOverviewExportController.getMembersByTeam));
reportingExportApiRouter.get("/allocation/export", viewReportsValidator, safeControllerFunction(ReportingAllocationController.export));
reportingExportApiRouter.get("/projects/export", viewReportsValidator, safeControllerFunction(ReportingProjectsExportController.export));
reportingExportApiRouter.get("/projects-time-log-breakdown/export", viewReportsValidator, safeControllerFunction(ReportingProjectsExportController.exportProjectTimeLogs));
reportingExportApiRouter.get("/members/export", viewReportsValidator, safeControllerFunction(ReportingMembersController.export));
reportingExportApiRouter.get("/project-members/export", viewReportsValidator, safeControllerFunction(ReportingOverviewExportController.exportProjectMembers));
reportingExportApiRouter.get("/project-tasks/export", viewReportsValidator, safeControllerFunction(ReportingOverviewExportController.exportProjectTasks));
reportingExportApiRouter.get("/project-member-tasks/export", viewReportsValidator, safeControllerFunction(ReportingOverviewExportController.exportProjectMemberTasks));
reportingExportApiRouter.get("/member-projects/export", viewReportsValidator, safeControllerFunction(ReportingMembersController.exportMemberProjects));
reportingExportApiRouter.get("/member-tasks/export", viewReportsValidator, safeControllerFunction(ReportingOverviewExportController.exportMemberTasks));
reportingExportApiRouter.get("/flat-tasks/export", viewReportsValidator, safeControllerFunction(ReportingOverviewExportController.exportFlatTasks));
reportingExportApiRouter.get("/member-time-log-breakdown/export", viewReportsValidator, safeControllerFunction(ReportingMembersController.exportTimeLogs));
reportingExportApiRouter.get("/member-activity-log-breakdown/export", viewReportsValidator, safeControllerFunction(ReportingMembersController.exportActivityLogs));
// The two timelogs-flat exports are superseded by /time-logs/export (CSV or Excel, filtered or all, with totals).
reportingExportApiRouter.get("/time-logs/export", viewReportsValidator, safeControllerFunction(ReportingTimeLogsController.exportTimeLogs));
reportingExportApiRouter.get("/timelogs-flat/export-csv", viewReportsValidator, safeControllerFunction(ReportingMembersController.exportTimelogsFlatCSV));
reportingExportApiRouter.get("/timelogs-flat/export-excel", viewReportsValidator, safeControllerFunction(ReportingMembersController.exportTimelogsFlatExcel));

export default reportingExportApiRouter;
