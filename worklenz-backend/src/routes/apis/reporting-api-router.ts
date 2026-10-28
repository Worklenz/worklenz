import express from "express";

import ReportingController from "../../controllers/reporting-controller";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import ReportingOverviewController from "../../controllers/reporting/overview/reporting-overview-controller";
import ReportingInfoController from "../../controllers/reporting/reporting-info-controller";
import ReportingAllocationController from "../../controllers/reporting/reporting-allocation-controller";
import ReportingProjectsController from "../../controllers/reporting/projects/reporting-projects-controller";
import ReportingMembersController from "../../controllers/reporting/reporting-members-controller";
import ReportingTimeLogsController from "../../controllers/reporting/reporting-time-logs-controller";
import ReportingAllTasksController from "../../controllers/reporting/reporting-all-tasks-controller";
import ProgressTrackingController from "../../controllers/reporting/progress-tracking/progress-tracking-controller";
import {
  CONFIDENCE_FILTERS,
  PERCENT_RANGE_FILTERS,
  SORT_FIELDS,
} from "../../controllers/reporting/progress-tracking/progress-tracking-query";
import { viewReportsValidator } from "../../middlewares/validators/organization-permission-validator";
import {
  validateUuidParam,
  validateUuidArrayParam,
  validateUuidArrayParamWithSentinels,
  validatePaginationParams,
  validateEnumParam
} from "../../middlewares/validators/query-param-validator";

const reportingApiRouter = express.Router();

reportingApiRouter.get("/info", viewReportsValidator, safeControllerFunction(ReportingInfoController.getInfo));

// Overview - All overview routes require admin/owner permissions only
reportingApiRouter.get("/overview/statistics", viewReportsValidator, safeControllerFunction(ReportingOverviewController.getStatistics));
reportingApiRouter.get("/overview/teams", viewReportsValidator, safeControllerFunction(ReportingOverviewController.getTeams));

// Overview projects - accepts team as query parameter (for pagination and filtering)
reportingApiRouter.get("/overview/projects",
  viewReportsValidator,
  validateUuidParam("team", "query"),
  safeControllerFunction(ReportingOverviewController.getProjects)
);

// Overview projects by team_id - path parameter version
reportingApiRouter.get("/overview/projects/:team_id",
  viewReportsValidator,
  validateUuidParam("team_id", "params"),
  safeControllerFunction(ReportingOverviewController.getProjectsByTeamOrMember)
);
reportingApiRouter.get("/overview/members/:team_id",
  viewReportsValidator,
  validateUuidParam("team_id", "params"),
  safeControllerFunction(ReportingOverviewController.getMembersByTeam)
);
reportingApiRouter.get("/overview/team/info/:team_id",
  viewReportsValidator,
  validateUuidParam("team_id", "params"),
  safeControllerFunction(ReportingOverviewController.getTeamOverview)
);

reportingApiRouter.get("/overview/project/info/:project_id",
  viewReportsValidator,
  validateUuidParam("project_id", "params"),
  safeControllerFunction(ReportingOverviewController.getProjectOverview)
);
reportingApiRouter.get("/overview/project/members/:project_id",
  viewReportsValidator,
  validateUuidParam("project_id", "params"),
  safeControllerFunction(ReportingOverviewController.getProjectMembers)
);
reportingApiRouter.get("/overview/project/tasks/:project_id",
  viewReportsValidator,
  validateUuidParam("project_id", "params"),
  safeControllerFunction(ReportingOverviewController.getProjectTasks)
);
reportingApiRouter.get("/overview/project/tasks-paginated/:project_id",
  viewReportsValidator,
  validateUuidParam("project_id", "params"),
  validatePaginationParams(),
  safeControllerFunction(ReportingOverviewController.getProjectTasksPaginated)
);

reportingApiRouter.get("/overview/member/info",
  viewReportsValidator,
  safeControllerFunction(ReportingOverviewController.getMemberOverview)
);
reportingApiRouter.get("/overview/team-member/info",
  viewReportsValidator,
  safeControllerFunction(ReportingOverviewController.getTeamMemberOverview)
);
reportingApiRouter.get("/overview/member/tasks/:team_member_id",
  viewReportsValidator,
  validateUuidParam("team_member_id", "params"),
  safeControllerFunction(ReportingOverviewController.getMemberTasks)
);

// Projects
reportingApiRouter.get("/projects",
  viewReportsValidator,
  validateUuidArrayParam("statuses", ","),      // ?statuses=uuid1,uuid2
  validateUuidArrayParam("healths", ","),        // ?healths=uuid1,uuid2
  validateUuidArrayParamWithSentinels("categories", ",", ["__no_category__"]),     // ?categories=uuid1,uuid2,__no_category__
  validateUuidArrayParam("project_managers", ","), // ?project_managers=uuid1,uuid2
  validateUuidArrayParam("teams", ","),          // ?teams=uuid1,uuid2
  validateEnumParam("archived", ["true", "false"]), // ?archived=true
  validatePaginationParams(),                    // ?page=1&page_size=20
  safeControllerFunction(ReportingProjectsController.get)
);
reportingApiRouter.get("/projects/grouped",
  viewReportsValidator,
  validateUuidArrayParam("statuses", ","),
  validateUuidArrayParam("healths", ","),
  validateUuidArrayParamWithSentinels("categories", ",", ["__no_category__"]),
  validateUuidArrayParam("project_managers", ","),
  validateUuidArrayParam("teams", ","),
  validateEnumParam("archived", ["true", "false"]),
  validateEnumParam("group_by", ["category", "status", "health", "team", "manager"]),
  validatePaginationParams(),
  safeControllerFunction(ReportingProjectsController.getGrouped)
);
reportingApiRouter.post("/project-timelogs", viewReportsValidator, safeControllerFunction(ReportingProjectsController.getProjectTimeLogs));

// members
reportingApiRouter.get("/members",
  viewReportsValidator,
  validateUuidArrayParam("teams", ","),  // ?teams=uuid1,uuid2
  validatePaginationParams(),
  safeControllerFunction(ReportingMembersController.getReportingMembers)
);

reportingApiRouter.post("/members/all", viewReportsValidator, safeControllerFunction(ReportingController.getReportingMembers));
reportingApiRouter.post("/projects-by-member", viewReportsValidator, safeControllerFunction(ReportingController.getProjectsByMember));
reportingApiRouter.get("/members/unassigned", viewReportsValidator, safeControllerFunction(ReportingController.getUnAssignedUsers));
reportingApiRouter.get("/members/overdue/:id", viewReportsValidator, idParamValidator, safeControllerFunction(ReportingController.getMembersWithOverDueTasks));
reportingApiRouter.get("/member/stats/:id", viewReportsValidator, idParamValidator, safeControllerFunction(ReportingController.getReportingMemberStats));
reportingApiRouter.get("/member/overview/:id", viewReportsValidator, idParamValidator, safeControllerFunction(ReportingController.getReportingMemberOverview));
reportingApiRouter.get("/member/projects", viewReportsValidator, safeControllerFunction(ReportingController.getMemberProjects));

reportingApiRouter.get("/member/project", viewReportsValidator, safeControllerFunction(ReportingController.getTasksByProject));
reportingApiRouter.get("/member/tasks", viewReportsValidator, safeControllerFunction(ReportingController.getReportingMembersTasks));

reportingApiRouter.post("/", viewReportsValidator, safeControllerFunction(ReportingController.create));
reportingApiRouter.post("/actual-vs-estimate", viewReportsValidator, safeControllerFunction(ReportingController.getEstimatedVsActualTime));
reportingApiRouter.post("/allocation", viewReportsValidator, safeControllerFunction(ReportingAllocationController.getAllocation));
reportingApiRouter.get("/allocation/teams", viewReportsValidator, safeControllerFunction(ReportingController.getMyTeams));
reportingApiRouter.post("/allocation/categories", viewReportsValidator, safeControllerFunction(ReportingController.getCategoriesByTeams));
reportingApiRouter.post("/allocation/projects", viewReportsValidator, safeControllerFunction(ReportingController.getProjectsByTeams));

reportingApiRouter.get("/overview/export", viewReportsValidator, safeControllerFunction(ReportingController.exportOverviewExcel));
reportingApiRouter.get("/allocation/export", viewReportsValidator, safeControllerFunction(ReportingController.exportAllocation));
reportingApiRouter.get("/projects/export", viewReportsValidator, safeControllerFunction(ReportingController.exportProjects));
reportingApiRouter.get("/members/export", viewReportsValidator, safeControllerFunction(ReportingController.exportMembers));
reportingApiRouter.get("/members/single-member-task-stats", viewReportsValidator, safeControllerFunction(ReportingMembersController.getMemberTaskStats));
reportingApiRouter.get("/members/single-member-projects", viewReportsValidator, safeControllerFunction(ReportingMembersController.getSingleMemberProjects));

reportingApiRouter.get("/member-projects", viewReportsValidator, safeControllerFunction(ReportingMembersController.getMemberProjects));
reportingApiRouter.post("/members/single-member-activities", viewReportsValidator, safeControllerFunction(ReportingMembersController.getMemberActivities));
reportingApiRouter.post("/members/single-member-timelogs", viewReportsValidator, safeControllerFunction(ReportingMembersController.getMemberTimelogs));
// Superseded by /time-logs below (server-side pagination, totals, user/project/practice filters).
// Kept as-is so a client still running an older frontend build keeps working.
reportingApiRouter.post("/members/timelogs-flat", viewReportsValidator, safeControllerFunction(ReportingMembersController.getTimelogsFlat));
reportingApiRouter.post("/time-logs", viewReportsValidator, safeControllerFunction(ReportingTimeLogsController.getTimeLogs));
reportingApiRouter.post("/time-logs/groups", viewReportsValidator, safeControllerFunction(ReportingTimeLogsController.getTimeLogGroups));
reportingApiRouter.get("/time-logs/members", viewReportsValidator, safeControllerFunction(ReportingTimeLogsController.getTimeLogMembers));
reportingApiRouter.get("/time-logs/projects", viewReportsValidator, safeControllerFunction(ReportingTimeLogsController.getTimeLogProjects));

reportingApiRouter.post("/time-reports/projects", viewReportsValidator, safeControllerFunction(ReportingAllocationController.getProjectTimeSheets));
reportingApiRouter.post("/time-reports/members", viewReportsValidator, safeControllerFunction(ReportingAllocationController.getMemberTimeSheets));
reportingApiRouter.post("/time-reports/estimated-vs-actual", viewReportsValidator, safeControllerFunction(ReportingAllocationController.getEstimatedVsActual));


// All Tasks Report - Export routes must come BEFORE base route for proper matching
reportingApiRouter.post("/all-tasks/export/csv", viewReportsValidator, safeControllerFunction(ReportingAllTasksController.exportCSV));
reportingApiRouter.post("/all-tasks/export/excel", viewReportsValidator, safeControllerFunction(ReportingAllTasksController.exportExcel));
reportingApiRouter.post("/all-tasks", viewReportsValidator, safeControllerFunction(ReportingAllTasksController.getReportingAllTasks));

reportingApiRouter.get("/progress-tracking",
  viewReportsValidator,
  validateEnumParam("confidence", [...CONFIDENCE_FILTERS]),
  validateEnumParam("percent_range", [...PERCENT_RANGE_FILTERS]),
  validateEnumParam("has_blockers", ["true", "false"]),
  validateEnumParam("field", [...SORT_FIELDS]),
  validateEnumParam("order", ["asc", "desc", "ascend", "descend"], false),
  validatePaginationParams("page", "page_size", 100),
  safeControllerFunction(ProgressTrackingController.get)
);


export default reportingApiRouter;