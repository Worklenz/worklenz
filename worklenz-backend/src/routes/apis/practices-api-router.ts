import express from "express";

import PracticesController from "../../controllers/practices-controller";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import teamOwnerOrAdminValidator from "../../middlewares/validators/team-owner-or-admin-validator";
import safeControllerFunction from "../../shared/safe-controller-function";

const practicesApiRouter = express.Router();

practicesApiRouter.post(
  "/",
  teamOwnerOrAdminValidator,
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
  teamOwnerOrAdminValidator,
  idParamValidator,
  safeControllerFunction(PracticesController.update),
);
practicesApiRouter.delete(
  "/:id",
  teamOwnerOrAdminValidator,
  idParamValidator,
  safeControllerFunction(PracticesController.deleteById),
);

export default practicesApiRouter;
