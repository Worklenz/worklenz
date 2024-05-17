import express, {Request, Response} from "express";

import idParamValidator from "../../../middlewares/validators/id-param-validator";
import safeControllerFunction from "../../../shared/safe-controller-function";
import RoadmapTasksControllerV2 from "../../../controllers/project-roadmap/roadmap-tasks-controller-v2";

const roadmapApiRouter = express.Router();

function getList(req: Request, res: Response) {
  if (RoadmapTasksControllerV2.isTasksOnlyReq(req.query))
    return RoadmapTasksControllerV2.getTasksOnly(req, res);
  return RoadmapTasksControllerV2.getList(req, res);
}

roadmapApiRouter.get("/chart-dates/:id", idParamValidator, safeControllerFunction(RoadmapTasksControllerV2.createDateRange));
roadmapApiRouter.get("/task-groups/:id", idParamValidator, safeControllerFunction(getList));

export default roadmapApiRouter;
