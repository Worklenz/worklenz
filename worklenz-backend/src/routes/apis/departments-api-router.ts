import express from "express";

import DepartmentsController from "../../controllers/departments-controller";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import teamOwnerOrAdminValidator from "../../middlewares/validators/team-owner-or-admin-validator";
import safeControllerFunction from "../../shared/safe-controller-function";

const departmentsApiRouter = express.Router();

departmentsApiRouter.post(
  "/",
  teamOwnerOrAdminValidator,
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
  teamOwnerOrAdminValidator,
  idParamValidator,
  safeControllerFunction(DepartmentsController.update),
);
departmentsApiRouter.delete(
  "/:id",
  teamOwnerOrAdminValidator,
  idParamValidator,
  safeControllerFunction(DepartmentsController.deleteById),
);

export default departmentsApiRouter;
