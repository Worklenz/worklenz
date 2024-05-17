import express from "express";
import teamOwnerOrAdminValidator from "../../middlewares/validators/team-owner-or-admin-validator";
import ptTaskStatusBodyValidator from "../../middlewares/validators/pt-task-status-body-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import PtTaskStatusesController from "../../controllers/project-templates/pt-task-statuses-controller";

const ptStatusesApiRouter = express.Router();

ptStatusesApiRouter.post("/", teamOwnerOrAdminValidator, ptTaskStatusBodyValidator, safeControllerFunction(PtTaskStatusesController.getCreated));
ptStatusesApiRouter.get("/", safeControllerFunction(PtTaskStatusesController.get));
// ptStatusesApiRouter.put("/order", statusOrderValidator, safeControllerFunction(PtTaskStatusesController.updateStatusOrder));
ptStatusesApiRouter.get("/categories", safeControllerFunction(PtTaskStatusesController.getCategories));
ptStatusesApiRouter.get("/:id", idParamValidator, safeControllerFunction(PtTaskStatusesController.getById));
ptStatusesApiRouter.put("/name/:id", teamOwnerOrAdminValidator, idParamValidator, ptTaskStatusBodyValidator, safeControllerFunction(PtTaskStatusesController.updateName));
ptStatusesApiRouter.put("/:id", teamOwnerOrAdminValidator, idParamValidator, ptTaskStatusBodyValidator, safeControllerFunction(PtTaskStatusesController.update));
// ptStatusesApiRouter.delete("/:id", teamOwnerOrAdminValidator, idParamValidator, statusDeleteValidator, safeControllerFunction(PtTaskStatusesController.deleteById));

export default ptStatusesApiRouter;