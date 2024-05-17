import express, {Request, Response} from "express";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import PtTasksController from "../../controllers/project-templates/pt-tasks-controller";
import mapTasksToBulkUpdate from "../../middlewares/map-tasks-to-bulk-update";
import bulkTasksValidator from "../../middlewares/validators/bulk-tasks-validator";

const ptTasksApiRouter = express.Router();

// split the controller between the counts query and the original data query
function getList(req: Request, res: Response) {
    if (PtTasksController.isTasksOnlyReq(req.query))
      return PtTasksController.getTasksOnly(req, res);
    return PtTasksController.getList(req, res);
  }

ptTasksApiRouter.get("/list/:id", idParamValidator, safeControllerFunction(getList));
ptTasksApiRouter.put("/bulk/delete", mapTasksToBulkUpdate, bulkTasksValidator, safeControllerFunction(PtTasksController.bulkDelete));

export default ptTasksApiRouter;