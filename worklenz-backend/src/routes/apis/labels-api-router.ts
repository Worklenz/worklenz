import express from "express";

import LabelsController from "../../controllers/labels-controller";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import teamOwnerOrAdminValidator from "../../middlewares/validators/team-owner-or-admin-validator";
import safeControllerFunction from "../../shared/safe-controller-function";

const labelsApiRouter = express.Router();

labelsApiRouter.get("/", safeControllerFunction(LabelsController.get));
labelsApiRouter.get("/tasks/:id", idParamValidator, safeControllerFunction(LabelsController.getByTask));
labelsApiRouter.get("/project/:id", idParamValidator, safeControllerFunction(LabelsController.getByProject));
labelsApiRouter.put("/tasks/:id", idParamValidator, teamOwnerOrAdminValidator, safeControllerFunction(LabelsController.updateColor));
labelsApiRouter.put("/team/:id", idParamValidator, teamOwnerOrAdminValidator, safeControllerFunction(LabelsController.updateLabel));
labelsApiRouter.delete("/team/:id", idParamValidator, teamOwnerOrAdminValidator, safeControllerFunction(LabelsController.deleteById));

export default labelsApiRouter;
