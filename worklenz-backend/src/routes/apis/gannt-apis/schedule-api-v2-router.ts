import express from "express";

import idParamValidator from "../../../middlewares/validators/id-param-validator";
import safeControllerFunction from "../../../shared/safe-controller-function";
import ScheduleControllerV2 from "../../../controllers/schedule-v2/schedule-controller";
import TaskTimelineController from "../../../controllers/schedule-v2/task-timeline-controller";
import TimeOffController from "../../../controllers/schedule-v2/time-off-controller";
import CapacityController from "../../../controllers/schedule-v2/capacity-controller";
import WorkloadController from "../../../controllers/schedule-v2/workload-controller";

const scheduleApiRouter = express.Router();

// ============================================
// Existing Schedule Endpoints (Project View)
// ============================================
scheduleApiRouter.get("/settings", safeControllerFunction(ScheduleControllerV2.getSettings));
scheduleApiRouter.put("/settings", safeControllerFunction(ScheduleControllerV2.updateSettings));
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

// Update task dates (drag-drop)
scheduleApiRouter.put("/tasks/:taskId/dates", idParamValidator, safeControllerFunction(TaskTimelineController.updateTaskDates));

// Get scheduling conflicts for a task
scheduleApiRouter.get("/tasks/:taskId/conflicts", idParamValidator, safeControllerFunction(TaskTimelineController.getTaskConflicts));

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

// ============================================
// Workload Management Endpoints (NEW)
// ============================================
// Get member workload data
scheduleApiRouter.get("/workload", safeControllerFunction(WorkloadController.getMemberWorkload));

// Update resource allocation
scheduleApiRouter.put("/allocation", safeControllerFunction(WorkloadController.updateResourceAllocation));

// Rebalance workload
scheduleApiRouter.post("/rebalance", safeControllerFunction(WorkloadController.rebalanceWorkload));

// Get resource conflicts
scheduleApiRouter.get("/conflicts", safeControllerFunction(WorkloadController.getResourceConflicts));

// Get capacity report
scheduleApiRouter.get("/capacity-report", safeControllerFunction(WorkloadController.getCapacityReport));

export default scheduleApiRouter;
