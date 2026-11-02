import express from "express";

import LabelsController from "../../controllers/labels-controller";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import { manageOrganizationSettingsValidator } from "../../middlewares/validators/organization-permission-validator";
import safeControllerFunction from "../../shared/safe-controller-function";

const labelsApiRouter = express.Router();

labelsApiRouter.get("/", safeControllerFunction(LabelsController.get));
labelsApiRouter.get("/tasks/:id", idParamValidator, safeControllerFunction(LabelsController.getByTask));
labelsApiRouter.get("/project/:id", idParamValidator, safeControllerFunction(LabelsController.getByProject));
labelsApiRouter.post("/", manageOrganizationSettingsValidator, safeControllerFunction(LabelsController.create));
labelsApiRouter.put("/tasks/:id", idParamValidator, manageOrganizationSettingsValidator, safeControllerFunction(LabelsController.updateColor));
labelsApiRouter.put("/team/:id", idParamValidator, manageOrganizationSettingsValidator, safeControllerFunction(LabelsController.updateLabel));
labelsApiRouter.delete("/team/:id", idParamValidator, manageOrganizationSettingsValidator, safeControllerFunction(LabelsController.deleteById));

export default labelsApiRouter;
