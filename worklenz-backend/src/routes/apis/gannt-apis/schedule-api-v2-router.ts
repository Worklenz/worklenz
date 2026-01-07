import express from "express";

import idParamValidator from "../../../middlewares/validators/id-param-validator";
import safeControllerFunction from "../../../shared/safe-controller-function";
import ScheduleControllerV2 from "../../../controllers/schedule-v2/schedule-controller";
import TaskTimelineController from "../../../controllers/schedule-v2/task-timeline-controller";
import TimeOffController from "../../../controllers/schedule-v2/time-off-controller";

const scheduleApiRouter = express.Router();

// ============================================
// Existing Schedule Endpoints (Project View)
// ============================================
scheduleApiRouter.get("/settings", safeControllerFunction(ScheduleControllerV2.getSettings));
scheduleApiRouter.put("/settings", safeControllerFunction(ScheduleControllerV2.updateSettings));
scheduleApiRouter.get("/dates/:date/:type", safeControllerFunction(ScheduleControllerV2.getDates));
scheduleApiRouter.get("/members", safeControllerFunction(ScheduleControllerV2.getOrganizationMembers));
scheduleApiRouter.get("/members/projects/:id", safeControllerFunction(ScheduleControllerV2.getOrganizationMemberProjects));
scheduleApiRouter.post("/schedule", safeControllerFunction(ScheduleControllerV2.createSchedule));

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

export default scheduleApiRouter;
