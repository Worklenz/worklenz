import express, {Request, Response} from "express";

import idParamValidator from "../../../middlewares/validators/id-param-validator";
import safeControllerFunction from "../../../shared/safe-controller-function";
import ScheduleControllerV2 from "../../../controllers/schedule/schedule-controller";

const scheduleApiRouter = express.Router();

function getList(req: Request, res: Response) {
  if (ScheduleControllerV2.isTasksOnlyReq(req.query))
    return ScheduleControllerV2.getTasksOnly(req, res);
  return ScheduleControllerV2.getList(req, res);
}

scheduleApiRouter.get("/chart-dates/:id", idParamValidator, safeControllerFunction(ScheduleControllerV2.createDateRange));
scheduleApiRouter.get("/projects/:id", idParamValidator, safeControllerFunction(ScheduleControllerV2.getProjects));
scheduleApiRouter.get("/project-member/:id", idParamValidator, safeControllerFunction(ScheduleControllerV2.getSingleProjectMember));
scheduleApiRouter.get("/refresh/project-indicator/:id", idParamValidator, safeControllerFunction(ScheduleControllerV2.getSingleProjectIndicator));
scheduleApiRouter.get("/tasks-by-member/:id", idParamValidator, safeControllerFunction(getList));
scheduleApiRouter.get("/migrate/member-allocations", safeControllerFunction(ScheduleControllerV2.migrate));
scheduleApiRouter.put("/bulk/delete-member-allocations", safeControllerFunction(ScheduleControllerV2.deleteMemberAllocations));

export default scheduleApiRouter;
