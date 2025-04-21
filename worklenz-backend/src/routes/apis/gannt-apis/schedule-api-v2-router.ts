import express, {Request, Response} from "express";

import idParamValidator from "../../../middlewares/validators/id-param-validator";
import safeControllerFunction from "../../../shared/safe-controller-function";
import ScheduleControllerV2 from "../../../controllers/schedule-v2/schedule-controller";

const scheduleApiRouter = express.Router();

// scheduleApiRouter.get("/chart-dates/:id", idParamValidator, safeControllerFunction(ScheduleControllerV2.createDateRange));
// scheduleApiRouter.get("/projects/:id", idParamValidator, safeControllerFunction(ScheduleControllerV2.getProjects));
// scheduleApiRouter.get("/project-member/:id", idParamValidator, safeControllerFunction(ScheduleControllerV2.getSingleProjectMember));
// scheduleApiRouter.get("/refresh/project-indicator/:id", idParamValidator, safeControllerFunction(ScheduleControllerV2.getSingleProjectIndicator));
// scheduleApiRouter.get("/tasks-by-member/:id", idParamValidator, safeControllerFunction(getList));
scheduleApiRouter.get("/settings", safeControllerFunction(ScheduleControllerV2.getSettings));
scheduleApiRouter.put("/settings", safeControllerFunction(ScheduleControllerV2.updateSettings));
scheduleApiRouter.get("/dates/:date/:type", safeControllerFunction(ScheduleControllerV2.getDates));
scheduleApiRouter.get("/members", safeControllerFunction(ScheduleControllerV2.getOrganizationMembers));
scheduleApiRouter.get("/members/projects/:id", safeControllerFunction(ScheduleControllerV2.getOrganizationMemberProjects));
scheduleApiRouter.post("/schedule", safeControllerFunction(ScheduleControllerV2.createSchedule));
// scheduleApiRouter.put("/bulk/delete-member-allocations", safeControllerFunction(ScheduleControllerV2.deleteMemberAllocations));

export default scheduleApiRouter;
