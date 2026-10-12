import express from "express";

import TaskStatusesController from "../../controllers/task-statuses-controller";

import idParamValidator from "../../middlewares/validators/id-param-validator";
import statusDeleteValidator from "../../middlewares/validators/status-delete-validator";
import statusOrderValidator from "../../middlewares/validators/status-order-validator";
import taskStatusBodyValidator from "../../middlewares/validators/task-status-body-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import { requireProjectPermission } from "../../middlewares/validators/require-project-permission";
import requireStatusPermission from "../../middlewares/validators/require-status-permission";

const statusesApiRouter = express.Router();

const requireStatuses = requireProjectPermission("statuses", {
  sources: ["query.current_project_id", "body.project_id", "query.project_id"],
});

statusesApiRouter.post("/", requireStatuses, taskStatusBodyValidator, safeControllerFunction(TaskStatusesController.getCreated));
statusesApiRouter.get("/", safeControllerFunction(TaskStatusesController.get));
statusesApiRouter.put("/order", requireStatuses, statusOrderValidator, safeControllerFunction(TaskStatusesController.updateStatusOrder));
statusesApiRouter.put("/color/:id", idParamValidator, requireStatusPermission, safeControllerFunction(TaskStatusesController.updateColor));
statusesApiRouter.get("/categories", safeControllerFunction(TaskStatusesController.getCategories));
statusesApiRouter.get("/:id", idParamValidator, safeControllerFunction(TaskStatusesController.getById));
statusesApiRouter.put("/name/:id", idParamValidator, requireStatusPermission, taskStatusBodyValidator, safeControllerFunction(TaskStatusesController.updateName));
statusesApiRouter.put("/category/:id", idParamValidator, requireStatusPermission, safeControllerFunction(TaskStatusesController.updateCategory));
statusesApiRouter.put("/:id", idParamValidator, requireStatusPermission, taskStatusBodyValidator, safeControllerFunction(TaskStatusesController.update));
statusesApiRouter.delete("/:id", idParamValidator, requireStatusPermission, statusDeleteValidator, safeControllerFunction(TaskStatusesController.deleteById));

export default statusesApiRouter;
