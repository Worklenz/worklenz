import express from "express";

import DepartmentsController from "../../controllers/departments-controller";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import { manageOrganizationSettingsValidator } from "../../middlewares/validators/organization-permission-validator";
import safeControllerFunction from "../../shared/safe-controller-function";

const departmentsApiRouter = express.Router();

departmentsApiRouter.post(
  "/",
  manageOrganizationSettingsValidator,
  safeControllerFunction(DepartmentsController.create),
);
departmentsApiRouter.get("/", safeControllerFunction(DepartmentsController.get));
departmentsApiRouter.get(
  "/:id",
  idParamValidator,
  safeControllerFunction(DepartmentsController.getById),
);
departmentsApiRouter.put(
  "/:id",
  manageOrganizationSettingsValidator,
  idParamValidator,
  safeControllerFunction(DepartmentsController.update),
);
departmentsApiRouter.delete(
  "/:id",
  manageOrganizationSettingsValidator,
  idParamValidator,
  safeControllerFunction(DepartmentsController.deleteById),
);

export default departmentsApiRouter;
