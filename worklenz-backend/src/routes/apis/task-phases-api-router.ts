import express from "express";

import TaskPhasesController from "../../controllers/task-phases-controller";
import schemaValidator from "../../middlewares/schema-validator";
import taskPhaseCreateSchema from "../../json_schemas/task-phase-create-schema";
import taskPhaseNameValidator from "../../middlewares/validators/task-phase-name-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import { requireProjectPermission } from "../../middlewares/validators/require-project-permission";

const taskPhasesApiRouter = express.Router();

const requirePhases = requireProjectPermission("phases", {
  sources: ["query.current_project_id", "body.project_id", "query.id", "query.project_id"],
});

taskPhasesApiRouter.post("/", requirePhases, safeControllerFunction(TaskPhasesController.create));
taskPhasesApiRouter.get("/", safeControllerFunction(TaskPhasesController.get));
taskPhasesApiRouter.put("/update-sort-order", requirePhases, safeControllerFunction(TaskPhasesController.updateSortOrder));
taskPhasesApiRouter.put(
  "/label/:id",
  requireProjectPermission("phases", { sources: ["params.id"] }),
  taskPhaseNameValidator,
  safeControllerFunction(TaskPhasesController.updateLabel)
);
taskPhasesApiRouter.put(
  "/sprint-settings/:id",
  requireProjectPermission("phases", { sources: ["params.id"] }),
  safeControllerFunction(TaskPhasesController.updateSprintSettings)
);
taskPhasesApiRouter.post("/:id/start", requirePhases, safeControllerFunction(TaskPhasesController.startSprint));
taskPhasesApiRouter.post("/:id/complete", requirePhases, safeControllerFunction(TaskPhasesController.completeSprint));
taskPhasesApiRouter.put("/change-color/:id", requirePhases, safeControllerFunction(TaskPhasesController.updateColor));
taskPhasesApiRouter.patch("/:id/default-assignee", requirePhases, safeControllerFunction(TaskPhasesController.updateDefaultAssignee));
taskPhasesApiRouter.put("/:id", requirePhases, taskPhaseNameValidator, schemaValidator(taskPhaseCreateSchema), safeControllerFunction(TaskPhasesController.update));
taskPhasesApiRouter.delete("/:id", requirePhases, safeControllerFunction(TaskPhasesController.deleteById));

export default taskPhasesApiRouter;
