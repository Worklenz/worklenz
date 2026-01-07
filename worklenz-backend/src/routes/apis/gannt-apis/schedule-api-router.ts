import express, {Request, Response} from "express";

import idParamValidator from "../../../middlewares/validators/id-param-validator";
import safeControllerFunction from "../../../shared/safe-controller-function";
import ScheduleControllerV2 from "../../../controllers/schedule/schedule-controller";
import verifyProjectAccess from "../../../middlewares/verify-project-access";
import teamOwnerOrAdminValidator from "../../../middlewares/validators/team-owner-or-admin-validator";
import verifyMemberAllocationAccess from "../../../middlewares/verify-member-allocation-access";

const scheduleApiRouter = express.Router();

function getList(req: Request, res: Response) {
  if (ScheduleControllerV2.isTasksOnlyReq(req.query))
    return ScheduleControllerV2.getTasksOnly(req, res);
  return ScheduleControllerV2.getList(req, res);
}

scheduleApiRouter.get("/chart-dates/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(ScheduleControllerV2.createDateRange));
scheduleApiRouter.get("/projects/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(ScheduleControllerV2.getProjects));
scheduleApiRouter.get("/project-member/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(ScheduleControllerV2.getSingleProjectMember));
scheduleApiRouter.get("/refresh/project-indicator/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(ScheduleControllerV2.getSingleProjectIndicator));
scheduleApiRouter.get("/tasks-by-member/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(getList));
scheduleApiRouter.get("/migrate/member-allocations", teamOwnerOrAdminValidator, safeControllerFunction(ScheduleControllerV2.migrate));
scheduleApiRouter.put("/bulk/delete-member-allocations", verifyMemberAllocationAccess('body', 'ids'), safeControllerFunction(ScheduleControllerV2.deleteMemberAllocations));

export default scheduleApiRouter;
