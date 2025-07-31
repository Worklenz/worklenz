import express from "express";
import teamOwnerOrAdminValidator from "../../middlewares/validators/team-owner-or-admin-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import taskPhaseNameValidator from "../../middlewares/validators/task-phase-name-validator";
import schemaValidator from "../../middlewares/schema-validator";
import PtTaskPhasesController from "../../controllers/project-templates/pt-task-phases-controller";
import taskPhaseCreateSchema from "../../json_schemas/task-phase-create-schema";

const ptTaskPhasesApiRouter = express.Router();

ptTaskPhasesApiRouter.post("/", teamOwnerOrAdminValidator, safeControllerFunction(PtTaskPhasesController.create));
ptTaskPhasesApiRouter.get("/", safeControllerFunction(PtTaskPhasesController.get));
ptTaskPhasesApiRouter.put("/label/:id", teamOwnerOrAdminValidator, taskPhaseNameValidator, safeControllerFunction(PtTaskPhasesController.updateLabel));
ptTaskPhasesApiRouter.put("/change-color/:id", teamOwnerOrAdminValidator, safeControllerFunction(PtTaskPhasesController.updateColor));

ptTaskPhasesApiRouter.put("/:id", teamOwnerOrAdminValidator, taskPhaseNameValidator, schemaValidator(taskPhaseCreateSchema), safeControllerFunction(PtTaskPhasesController.update));
ptTaskPhasesApiRouter.delete("/:id", teamOwnerOrAdminValidator, safeControllerFunction(PtTaskPhasesController.deleteById));

export default ptTaskPhasesApiRouter;
