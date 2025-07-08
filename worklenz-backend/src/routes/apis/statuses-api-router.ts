import express from "express";

import TaskStatusesController from "../../controllers/task-statuses-controller";

import idParamValidator from "../../middlewares/validators/id-param-validator";
import statusDeleteValidator from "../../middlewares/validators/status-delete-validator";
import statusOrderValidator from "../../middlewares/validators/status-order-validator";
import taskStatusBodyValidator from "../../middlewares/validators/task-status-body-validator";
import teamOwnerOrAdminValidator from "../../middlewares/validators/team-owner-or-admin-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import projectManagerValidator from "../../middlewares/validators/project-manager-validator";

const statusesApiRouter = express.Router();

statusesApiRouter.post("/", projectManagerValidator, taskStatusBodyValidator, safeControllerFunction(TaskStatusesController.getCreated));
statusesApiRouter.get("/", safeControllerFunction(TaskStatusesController.get));
statusesApiRouter.put("/order", statusOrderValidator, safeControllerFunction(TaskStatusesController.updateStatusOrder));
statusesApiRouter.get("/categories", safeControllerFunction(TaskStatusesController.getCategories));
statusesApiRouter.get("/:id", idParamValidator, safeControllerFunction(TaskStatusesController.getById));
statusesApiRouter.put("/name/:id", projectManagerValidator, idParamValidator, taskStatusBodyValidator, safeControllerFunction(TaskStatusesController.updateName));
statusesApiRouter.put("/category/:id", projectManagerValidator, idParamValidator, safeControllerFunction(TaskStatusesController.updateCategory));
statusesApiRouter.put("/:id", projectManagerValidator, idParamValidator, taskStatusBodyValidator, safeControllerFunction(TaskStatusesController.update));
statusesApiRouter.delete("/:id", projectManagerValidator, idParamValidator, statusDeleteValidator, safeControllerFunction(TaskStatusesController.deleteById));

export default statusesApiRouter;
