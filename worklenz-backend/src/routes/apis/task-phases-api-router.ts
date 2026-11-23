import express from "express";

import TaskPhasesController from "../../controllers/task-phases-controller";
import schemaValidator from "../../middlewares/schema-validator";
import taskPhaseCreateSchema from "../../json_schemas/task-phase-create-schema";
import taskPhaseNameValidator from "../../middlewares/validators/task-phase-name-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import { requireProjectPermission } from "../../middlewares/validators/require-project-permission";
import { requireFeature } from "../../shared/entitlements/gates";
import verifyProjectAccess from "../../middlewares/verify-project-access";

const taskPhasesApiRouter = express.Router();

const requireQueryProjectPhases = requireProjectPermission("phases", { sources: ["query.id"] });
const requireBodyProjectPhases = requireProjectPermission("phases", { sources: ["body.project_id"] });

taskPhasesApiRouter.post("/", requireQueryProjectPhases, safeControllerFunction(TaskPhasesController.create));
taskPhasesApiRouter.get("/", verifyProjectAccess("query", "id"), safeControllerFunction(TaskPhasesController.get));
taskPhasesApiRouter.put("/update-sort-order", requireBodyProjectPhases, safeControllerFunction(TaskPhasesController.updateSortOrder));
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
taskPhasesApiRouter.post("/:id/start", requireQueryProjectPhases, safeControllerFunction(TaskPhasesController.startSprint));
taskPhasesApiRouter.post("/:id/complete", requireQueryProjectPhases, safeControllerFunction(TaskPhasesController.completeSprint));
taskPhasesApiRouter.put("/change-color/:id", requireQueryProjectPhases, safeControllerFunction(TaskPhasesController.updateColor));
taskPhasesApiRouter.patch("/:id/default-assignee", requireQueryProjectPhases, requireFeature("phase_assignee"), safeControllerFunction(TaskPhasesController.updateDefaultAssignee));
taskPhasesApiRouter.put("/:id", requireQueryProjectPhases, taskPhaseNameValidator, schemaValidator(taskPhaseCreateSchema), safeControllerFunction(TaskPhasesController.update));
taskPhasesApiRouter.delete("/:id", requireQueryProjectPhases, safeControllerFunction(TaskPhasesController.deleteById));

export default taskPhasesApiRouter;
