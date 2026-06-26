import express from "express";
import safeControllerFunction from "../../shared/safe-controller-function";
import TeamLeadReportsController from "../../controllers/team-lead-reports-controller";

const teamLeadReportsApiRouter = express.Router();

// Get team members managed by the current team lead
teamLeadReportsApiRouter.get("/my-team-members", safeControllerFunction(TeamLeadReportsController.getMyTeamMembers));

// Get time logs summary for team members
teamLeadReportsApiRouter.get("/team-time-logs-summary", safeControllerFunction(TeamLeadReportsController.getTeamTimeLogsSummary));

// Get detailed time logs for a specific member
teamLeadReportsApiRouter.get("/member-time-logs/:memberId", safeControllerFunction(TeamLeadReportsController.getMemberDetailedTimeLogs));

// Get team performance statistics
teamLeadReportsApiRouter.get("/team-performance", safeControllerFunction(TeamLeadReportsController.getTeamPerformanceStats));

export default teamLeadReportsApiRouter;


