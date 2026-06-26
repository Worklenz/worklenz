import express, {Request, Response} from "express";
import WorkloadGanntController from "../../../controllers/project-workload/workload-gannt-controller";
import idParamValidator from "../../../middlewares/validators/id-param-validator";
import safeControllerFunction from "../../../shared/safe-controller-function";
import verifyProjectAccess from "../../../middlewares/verify-project-access";

const workloadApiRouter = express.Router();

function getList(req: Request, res: Response) {
  if (WorkloadGanntController.isTasksOnlyReq(req.query))
    return WorkloadGanntController.getTasksOnly(req, res);
  return WorkloadGanntController.getList(req, res);
}

workloadApiRouter.get("/chart-dates/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(WorkloadGanntController.createDateRange));
workloadApiRouter.get("/workload-members/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(WorkloadGanntController.getMembers));
workloadApiRouter.get("/workload-tasks-by-member/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(getList));
workloadApiRouter.get("/workload-overview-by-member/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(WorkloadGanntController.getMemberOverview));

export default workloadApiRouter;
