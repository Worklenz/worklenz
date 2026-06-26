import express from "express";

import ReportingController from "../../controllers/reporting-controller";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import ReportingOverviewController from "../../controllers/reporting/overview/reporting-overview-controller";
import ReportingInfoController from "../../controllers/reporting/reporting-info-controller";
import ReportingAllocationController from "../../controllers/reporting/reporting-allocation-controller";
import ReportingProjectsController from "../../controllers/reporting/projects/reporting-projects-controller";
import ReportingMembersController from "../../controllers/reporting/reporting-members-controller";
import ReportingAllTasksController from "../../controllers/reporting/reporting-all-tasks-controller";
import teamOwnerOrAdminValidator from "../../middlewares/validators/team-owner-or-admin-validator";
import {
  validateUuidParam,
  validateUuidArrayParam,
  validatePaginationParams,
  validateEnumParam
} from "../../middlewares/validators/query-param-validator";

const reportingApiRouter = express.Router();

reportingApiRouter.get("/info", teamOwnerOrAdminValidator, safeControllerFunction(ReportingInfoController.getInfo));

// Overview - All overview routes require admin/owner permissions only
reportingApiRouter.get("/overview/statistics", teamOwnerOrAdminValidator, safeControllerFunction(ReportingOverviewController.getStatistics));
reportingApiRouter.get("/overview/teams", teamOwnerOrAdminValidator, safeControllerFunction(ReportingOverviewController.getTeams));

// Overview projects - accepts team as query parameter (for pagination and filtering)
reportingApiRouter.get("/overview/projects",
  teamOwnerOrAdminValidator,
  validateUuidParam("team", "query"),
  safeControllerFunction(ReportingOverviewController.getProjects)
);

// Overview projects by team_id - path parameter version
reportingApiRouter.get("/overview/projects/:team_id",
  teamOwnerOrAdminValidator,
  validateUuidParam("team_id", "params"),
  safeControllerFunction(ReportingOverviewController.getProjectsByTeamOrMember)
);
reportingApiRouter.get("/overview/members/:team_id",
  teamOwnerOrAdminValidator,
  validateUuidParam("team_id", "params"),
  safeControllerFunction(ReportingOverviewController.getMembersByTeam)
);
reportingApiRouter.get("/overview/team/info/:team_id",
  teamOwnerOrAdminValidator,
  validateUuidParam("team_id", "params"),
  safeControllerFunction(ReportingOverviewController.getTeamOverview)
);

reportingApiRouter.get("/overview/project/info/:project_id",
  teamOwnerOrAdminValidator,
  validateUuidParam("project_id", "params"),
  safeControllerFunction(ReportingOverviewController.getProjectOverview)
);
reportingApiRouter.get("/overview/project/members/:project_id",
  teamOwnerOrAdminValidator,
  validateUuidParam("project_id", "params"),
  safeControllerFunction(ReportingOverviewController.getProjectMembers)
);
reportingApiRouter.get("/overview/project/tasks/:project_id",
  teamOwnerOrAdminValidator,
  validateUuidParam("project_id", "params"),
  safeControllerFunction(ReportingOverviewController.getProjectTasks)
);
reportingApiRouter.get("/overview/project/tasks-paginated/:project_id",
  teamOwnerOrAdminValidator,
  validateUuidParam("project_id", "params"),
  validatePaginationParams(),
  safeControllerFunction(ReportingOverviewController.getProjectTasksPaginated)
);

reportingApiRouter.get("/overview/member/info",
  teamOwnerOrAdminValidator,
  safeControllerFunction(ReportingOverviewController.getMemberOverview)
);
reportingApiRouter.get("/overview/team-member/info",
  teamOwnerOrAdminValidator,
  safeControllerFunction(ReportingOverviewController.getTeamMemberOverview)
);
reportingApiRouter.get("/overview/member/tasks/:team_member_id",
  teamOwnerOrAdminValidator,
  validateUuidParam("team_member_id", "params"),
  safeControllerFunction(ReportingOverviewController.getMemberTasks)
);

// Projects
reportingApiRouter.get("/projects",
  teamOwnerOrAdminValidator,
  validateUuidArrayParam("statuses", ","),      // ?statuses=uuid1,uuid2
  validateUuidArrayParam("healths", ","),        // ?healths=uuid1,uuid2
  validateUuidArrayParam("categories", ","),     // ?categories=uuid1,uuid2
  validateUuidArrayParam("project_managers", ","), // ?project_managers=uuid1,uuid2
  validateUuidArrayParam("teams", ","),          // ?teams=uuid1,uuid2
  validateEnumParam("archived", ["true", "false"]), // ?archived=true
  validatePaginationParams(),                    // ?page=1&page_size=20
  safeControllerFunction(ReportingProjectsController.get)
);
reportingApiRouter.get("/projects/grouped",
  teamOwnerOrAdminValidator,
  validateUuidArrayParam("statuses", ","),
  validateUuidArrayParam("healths", ","),
  validateUuidArrayParam("categories", ","),
  validateUuidArrayParam("project_managers", ","),
  validateUuidArrayParam("teams", ","),
  validateEnumParam("archived", ["true", "false"]),
  validateEnumParam("group_by", ["category", "status", "health", "team", "manager"]),
  validatePaginationParams(),
  safeControllerFunction(ReportingProjectsController.getGrouped)
);
reportingApiRouter.post("/project-timelogs", teamOwnerOrAdminValidator, safeControllerFunction(ReportingProjectsController.getProjectTimeLogs));

// members
reportingApiRouter.get("/members",
  teamOwnerOrAdminValidator,
  validateUuidArrayParam("teams", ","),  // ?teams=uuid1,uuid2
  validatePaginationParams(),
  safeControllerFunction(ReportingMembersController.getReportingMembers)
);

reportingApiRouter.post("/members/all", teamOwnerOrAdminValidator, safeControllerFunction(ReportingController.getReportingMembers));
reportingApiRouter.post("/projects-by-member", teamOwnerOrAdminValidator, safeControllerFunction(ReportingController.getProjectsByMember));
reportingApiRouter.get("/members/unassigned", teamOwnerOrAdminValidator, safeControllerFunction(ReportingController.getUnAssignedUsers));
reportingApiRouter.get("/members/overdue/:id", teamOwnerOrAdminValidator, idParamValidator, safeControllerFunction(ReportingController.getMembersWithOverDueTasks));
reportingApiRouter.get("/member/stats/:id", teamOwnerOrAdminValidator, idParamValidator, safeControllerFunction(ReportingController.getReportingMemberStats));
reportingApiRouter.get("/member/overview/:id", teamOwnerOrAdminValidator, idParamValidator, safeControllerFunction(ReportingController.getReportingMemberOverview));
reportingApiRouter.get("/member/projects", teamOwnerOrAdminValidator, safeControllerFunction(ReportingController.getMemberProjects));

reportingApiRouter.get("/member/project", teamOwnerOrAdminValidator, safeControllerFunction(ReportingController.getTasksByProject));
reportingApiRouter.get("/member/tasks", teamOwnerOrAdminValidator, safeControllerFunction(ReportingController.getReportingMembersTasks));

reportingApiRouter.post("/", teamOwnerOrAdminValidator, safeControllerFunction(ReportingController.create));
reportingApiRouter.post("/actual-vs-estimate", teamOwnerOrAdminValidator, safeControllerFunction(ReportingController.getEstimatedVsActualTime));
reportingApiRouter.post("/allocation", teamOwnerOrAdminValidator, safeControllerFunction(ReportingAllocationController.getAllocation));
reportingApiRouter.get("/allocation/teams", teamOwnerOrAdminValidator, safeControllerFunction(ReportingController.getMyTeams));
reportingApiRouter.post("/allocation/categories", teamOwnerOrAdminValidator, safeControllerFunction(ReportingController.getCategoriesByTeams));
reportingApiRouter.post("/allocation/projects", teamOwnerOrAdminValidator, safeControllerFunction(ReportingController.getProjectsByTeams));

reportingApiRouter.get("/overview/export", teamOwnerOrAdminValidator, safeControllerFunction(ReportingController.exportOverviewExcel));
reportingApiRouter.get("/allocation/export", teamOwnerOrAdminValidator, safeControllerFunction(ReportingController.exportAllocation));
reportingApiRouter.get("/projects/export", teamOwnerOrAdminValidator, safeControllerFunction(ReportingController.exportProjects));
reportingApiRouter.get("/members/export", teamOwnerOrAdminValidator, safeControllerFunction(ReportingController.exportMembers));
reportingApiRouter.get("/members/single-member-task-stats", teamOwnerOrAdminValidator, safeControllerFunction(ReportingMembersController.getMemberTaskStats));
reportingApiRouter.get("/members/single-member-projects", teamOwnerOrAdminValidator, safeControllerFunction(ReportingMembersController.getSingleMemberProjects));

reportingApiRouter.get("/member-projects", teamOwnerOrAdminValidator, safeControllerFunction(ReportingMembersController.getMemberProjects));
reportingApiRouter.post("/members/single-member-activities", teamOwnerOrAdminValidator, safeControllerFunction(ReportingMembersController.getMemberActivities));
reportingApiRouter.post("/members/single-member-timelogs", teamOwnerOrAdminValidator, safeControllerFunction(ReportingMembersController.getMemberTimelogs));
reportingApiRouter.post("/members/timelogs-flat", teamOwnerOrAdminValidator, safeControllerFunction(ReportingMembersController.getTimelogsFlat));

reportingApiRouter.post("/time-reports/projects", teamOwnerOrAdminValidator, safeControllerFunction(ReportingAllocationController.getProjectTimeSheets));
reportingApiRouter.post("/time-reports/members", teamOwnerOrAdminValidator, safeControllerFunction(ReportingAllocationController.getMemberTimeSheets));
reportingApiRouter.post("/time-reports/estimated-vs-actual", teamOwnerOrAdminValidator, safeControllerFunction(ReportingAllocationController.getEstimatedVsActual));


// All Tasks Report - Export routes must come BEFORE base route for proper matching
reportingApiRouter.post("/all-tasks/export/csv", teamOwnerOrAdminValidator, safeControllerFunction(ReportingAllTasksController.exportCSV));
reportingApiRouter.post("/all-tasks/export/excel", teamOwnerOrAdminValidator, safeControllerFunction(ReportingAllTasksController.exportExcel));
reportingApiRouter.post("/all-tasks", teamOwnerOrAdminValidator, safeControllerFunction(ReportingAllTasksController.getReportingAllTasks));


export default reportingApiRouter;