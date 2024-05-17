import express from "express";

import TaskPhasesController from "../../controllers/task-phases-controller";
import schemaValidator from "../../middlewares/schema-validator";
import taskPhaseCreateSchema from "../../json_schemas/task-phase-create-schema";
import taskPhaseNameValidator from "../../middlewares/validators/task-phase-name-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import projectManagerValidator from "../../middlewares/validators/project-manager-validator";

const taskPhasesApiRouter = express.Router();

taskPhasesApiRouter.post("/", projectManagerValidator, safeControllerFunction(TaskPhasesController.create));
taskPhasesApiRouter.get("/", safeControllerFunction(TaskPhasesController.get));
taskPhasesApiRouter.put("/update-sort-order", projectManagerValidator, safeControllerFunction(TaskPhasesController.updateSortOrder));
taskPhasesApiRouter.put("/label/:id", projectManagerValidator, taskPhaseNameValidator, safeControllerFunction(TaskPhasesController.updateLabel));
taskPhasesApiRouter.put("/change-color/:id", projectManagerValidator, schemaValidator(taskPhaseCreateSchema), safeControllerFunction(TaskPhasesController.updateColor));
taskPhasesApiRouter.put("/:id", projectManagerValidator, taskPhaseNameValidator, schemaValidator(taskPhaseCreateSchema), safeControllerFunction(TaskPhasesController.update));
taskPhasesApiRouter.delete("/:id", projectManagerValidator, safeControllerFunction(TaskPhasesController.deleteById));

export default taskPhasesApiRouter;
