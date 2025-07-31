import express, {Request, Response} from "express";
import WorkloadGanntController from "../../../controllers/project-workload/workload-gannt-controller";
import idParamValidator from "../../../middlewares/validators/id-param-validator";
import safeControllerFunction from "../../../shared/safe-controller-function";

const workloadApiRouter = express.Router();

function getList(req: Request, res: Response) {
  if (WorkloadGanntController.isTasksOnlyReq(req.query))
    return WorkloadGanntController.getTasksOnly(req, res);
  return WorkloadGanntController.getList(req, res);
}

workloadApiRouter.get("/chart-dates/:id", idParamValidator, safeControllerFunction(WorkloadGanntController.createDateRange));
workloadApiRouter.get("/workload-members/:id", idParamValidator, safeControllerFunction(WorkloadGanntController.getMembers));
workloadApiRouter.get("/workload-tasks-by-member/:id", idParamValidator, safeControllerFunction(getList));
workloadApiRouter.get("/workload-overview-by-member/:id", idParamValidator, safeControllerFunction(WorkloadGanntController.getMemberOverview));

export default workloadApiRouter;
