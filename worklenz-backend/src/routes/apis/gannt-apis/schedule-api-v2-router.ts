import express from "express";

import idParamValidator from "../../../middlewares/validators/id-param-validator";
import { validateUuidParam } from "../../../middlewares/validators/query-param-validator";
import safeControllerFunction from "../../../shared/safe-controller-function";
import ScheduleControllerV2 from "../../../controllers/schedule-v2/schedule-controller";
import TaskTimelineController from "../../../controllers/schedule-v2/task-timeline-controller";
import ProjectTimelineController from "../../../controllers/schedule-v2/project-timeline-controller";
import TimeOffController from "../../../controllers/schedule-v2/time-off-controller";
import CapacityController from "../../../controllers/schedule-v2/capacity-controller";
import WorkloadController from "../../../controllers/schedule-v2/workload-controller";
import { verifyNonGuestProjectAccess } from "../../../middlewares/verify-project-access";
import verifyTaskAccess, { verifyNonGuestTaskAccess } from "../../../middlewares/verify-task-access";
import verifyNonGuestPlannerAccess from "../../../middlewares/verify-non-guest-planner-access";
import { requireAnyFeature } from "../../../shared/entitlements/gates";
import { PLANNER_FEATURES } from "../../../shared/entitlements/feature-registry";

const scheduleApiRouter = express.Router();

// Guests do not have access to the Planner (Schedule/Timeline/Workload) at all.
scheduleApiRouter.use(verifyNonGuestPlannerAccess);

// Shared endpoints, available on every plan because screens outside the Planner use them:
//  - working days/hours settings (admin-center settings, utilization calculations)
//  - time-off, a personal calendar feature (Home calendar, quick actions)
// Everything registered after the requireAnyFeature gate below is Planner-only.
scheduleApiRouter.get("/settings", safeControllerFunction(ScheduleControllerV2.getSettings));
scheduleApiRouter.put("/settings", safeControllerFunction(ScheduleControllerV2.updateSettings));

// ============================================
// Time-Off Management Endpoints
// ============================================
// Get time-off entries
scheduleApiRouter.get("/time-off", safeControllerFunction(TimeOffController.getTimeOff));

// Get time-off summary for date range
scheduleApiRouter.get("/time-off/summary", safeControllerFunction(TimeOffController.getTimeOffSummary));

// Create time-off entry
scheduleApiRouter.post("/time-off", safeControllerFunction(TimeOffController.createTimeOff));

// Update time-off entry
scheduleApiRouter.put("/time-off/:id", idParamValidator, safeControllerFunction(TimeOffController.updateTimeOff));

// Delete time-off entry
scheduleApiRouter.delete("/time-off/:id", idParamValidator, safeControllerFunction(TimeOffController.deleteTimeOff));

// Planner-only endpoints: Schedule, Timeline and Workload (any of them grants API access).
scheduleApiRouter.use(requireAnyFeature(PLANNER_FEATURES));


// ============================================
// Existing Schedule Endpoints (Project View)
// ============================================
scheduleApiRouter.get("/dates/:date/:type", safeControllerFunction(ScheduleControllerV2.getDates));
scheduleApiRouter.get("/members", safeControllerFunction(ScheduleControllerV2.getOrganizationMembers));
scheduleApiRouter.get("/members/projects/:id", safeControllerFunction(ScheduleControllerV2.getOrganizationMemberProjects));
scheduleApiRouter.get("/members/:memberId/summary", safeControllerFunction(ScheduleControllerV2.getMemberScheduleSummary));
scheduleApiRouter.post("/schedule", safeControllerFunction(ScheduleControllerV2.createSchedule));

// ============================================
// Capacity Management Endpoints (NEW)
// ============================================
// Get daily capacity for all members
scheduleApiRouter.get("/capacity/daily", safeControllerFunction(CapacityController.getDailyCapacity));

// Get capacity summary (aggregated)
scheduleApiRouter.get("/capacity/summary", safeControllerFunction(CapacityController.getCapacitySummary));

// Get capacity conflicts (over-allocations)
scheduleApiRouter.get("/capacity/conflicts", safeControllerFunction(CapacityController.getCapacityConflicts));

// ============================================
// Task Timeline Endpoints (Task View)
// ============================================
// Get tasks for timeline view with filters
scheduleApiRouter.get("/tasks", safeControllerFunction(TaskTimelineController.getTasksForTimeline));

// Update task dates (drag-drop) — MUTATION, requires non-guest access to the task's team/project
scheduleApiRouter.put(
  "/tasks/:taskId/dates",
  validateUuidParam("taskId", "params"),
  verifyNonGuestTaskAccess('params', 'taskId'),
  safeControllerFunction(TaskTimelineController.updateTaskDates)
);

// Get scheduling conflicts for a task — requires access to the task's team/project
scheduleApiRouter.get(
  "/tasks/:taskId/conflicts",
  validateUuidParam("taskId", "params"),
  verifyTaskAccess('params', 'taskId'),
  safeControllerFunction(TaskTimelineController.getTaskConflicts)
);

// ============================================
// Project Timeline Endpoints (Portfolio View)
// ============================================
// Get all projects with date range + todo/doing/done breakdown
scheduleApiRouter.get("/timeline/projects", safeControllerFunction(ProjectTimelineController.getProjectsTimeline));

// Update a project's start/end date (drag-resize on the Timeline bar)
scheduleApiRouter.put("/timeline/projects/:id/dates", idParamValidator, safeControllerFunction(ProjectTimelineController.updateProjectDates));

// ============================================
// Workload Management Endpoints (NEW)
// ============================================
// Get member workload data
scheduleApiRouter.get("/workload", safeControllerFunction(WorkloadController.getMemberWorkload));

// Update resource allocation (MUTATION — Requires non-guest access)
scheduleApiRouter.put("/allocation", verifyNonGuestProjectAccess('body', 'project_id'), safeControllerFunction(WorkloadController.updateResourceAllocation));

// Rebalance workload (MUTATION — Requires non-guest access)
scheduleApiRouter.post("/rebalance", verifyNonGuestProjectAccess('body', 'project_id'), safeControllerFunction(WorkloadController.rebalanceWorkload));

// Get resource conflicts
scheduleApiRouter.get("/conflicts", safeControllerFunction(WorkloadController.getResourceConflicts));

// Get capacity report
scheduleApiRouter.get("/capacity-report", safeControllerFunction(WorkloadController.getCapacityReport));

export default scheduleApiRouter;
