import express from "express";
import teamOwnerOrAdminValidator from "../../middlewares/validators/team-owner-or-admin-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import taskPhaseNameValidator from "../../middlewares/validators/task-phase-name-validator";
import schemaValidator from "../../middlewares/schema-validator";
import PtTaskPhasesController from "../../controllers/project-templates/pt-task-phases-controller";
import taskPhaseCreateSchema from "../../json_schemas/task-phase-create-schema";
import { verifyTemplateReadAccess, verifyTemplateWriteAccess } from "../../middlewares/verify-template-access";

const ptTaskPhasesApiRouter = express.Router();

ptTaskPhasesApiRouter.post("/", teamOwnerOrAdminValidator, verifyTemplateWriteAccess("query", "id"), safeControllerFunction(PtTaskPhasesController.create));
ptTaskPhasesApiRouter.get("/", verifyTemplateReadAccess("query", "id"), safeControllerFunction(PtTaskPhasesController.get));
ptTaskPhasesApiRouter.put("/label/:id", teamOwnerOrAdminValidator, taskPhaseNameValidator, verifyTemplateWriteAccess("params", "id"), safeControllerFunction(PtTaskPhasesController.updateLabel));
ptTaskPhasesApiRouter.put("/change-color/:id", teamOwnerOrAdminValidator, verifyTemplateWriteAccess("query", "id"), safeControllerFunction(PtTaskPhasesController.updateColor));

ptTaskPhasesApiRouter.put("/:id", teamOwnerOrAdminValidator, taskPhaseNameValidator, schemaValidator(taskPhaseCreateSchema), verifyTemplateWriteAccess("query", "id"), safeControllerFunction(PtTaskPhasesController.update));
ptTaskPhasesApiRouter.delete("/:id", teamOwnerOrAdminValidator, verifyTemplateWriteAccess("query", "id"), safeControllerFunction(PtTaskPhasesController.deleteById));

export default ptTaskPhasesApiRouter;
