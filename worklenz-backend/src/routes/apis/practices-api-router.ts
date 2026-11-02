import express from "express";

import PracticesController from "../../controllers/practices-controller";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import { manageOrganizationSettingsValidator } from "../../middlewares/validators/organization-permission-validator";
import safeControllerFunction from "../../shared/safe-controller-function";

const practicesApiRouter = express.Router();

practicesApiRouter.post(
  "/",
  manageOrganizationSettingsValidator,
  safeControllerFunction(PracticesController.create),
);
practicesApiRouter.get("/", safeControllerFunction(PracticesController.get));
practicesApiRouter.get(
  "/:id",
  idParamValidator,
  safeControllerFunction(PracticesController.getById),
);
practicesApiRouter.put(
  "/:id",
  manageOrganizationSettingsValidator,
  idParamValidator,
  safeControllerFunction(PracticesController.update),
);
practicesApiRouter.delete(
  "/:id",
  manageOrganizationSettingsValidator,
  idParamValidator,
  safeControllerFunction(PracticesController.deleteById),
);

export default practicesApiRouter;
