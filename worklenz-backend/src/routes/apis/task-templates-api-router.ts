import express from "express";

import TasktemplatesController from "../../controllers/task-templates-controller";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import importTaskTemplatesValidator from "../../middlewares/validators/import-task-templates-validator";
import bodyNameValidator from "../../middlewares/validators/body-name-validator";
import safeControllerFunction from "../../shared/safe-controller-function";

const taskTemplatesApiRouter = express.Router();

taskTemplatesApiRouter.post("/", bodyNameValidator, safeControllerFunction(TasktemplatesController.create));
taskTemplatesApiRouter.post("/import/:id", importTaskTemplatesValidator, safeControllerFunction(TasktemplatesController.import));
taskTemplatesApiRouter.get("/", safeControllerFunction(TasktemplatesController.get));
taskTemplatesApiRouter.get("/:id", idParamValidator, safeControllerFunction(TasktemplatesController.getById));
taskTemplatesApiRouter.put("/:id", idParamValidator, safeControllerFunction(TasktemplatesController.update));
taskTemplatesApiRouter.delete("/:id", idParamValidator, safeControllerFunction(TasktemplatesController.deleteById));

export default taskTemplatesApiRouter;
