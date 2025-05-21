import express from "express";

import RateCardController from "../../controllers/ratecard-controller";


import idParamValidator from "../../middlewares/validators/id-param-validator";
import teamOwnerOrAdminValidator from "../../middlewares/validators/team-owner-or-admin-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import projectManagerValidator from "../../middlewares/validators/project-manager-validator";
import ratecardBodyValidator from "../../middlewares/validators/ratecard-body-validator";

const ratecardApiRouter = express.Router();

ratecardApiRouter.post(
  "/",
  projectManagerValidator,
  ratecardBodyValidator,
  safeControllerFunction(RateCardController.create)
);

ratecardApiRouter.get(
  "/",
  safeControllerFunction(RateCardController.get)
);

ratecardApiRouter.get(
  "/:id",
  teamOwnerOrAdminValidator,
  idParamValidator,
  safeControllerFunction(RateCardController.getById)
);

ratecardApiRouter.put(
  "/:id",
  teamOwnerOrAdminValidator,
  ratecardBodyValidator,
  idParamValidator,
  safeControllerFunction(RateCardController.update)
);

ratecardApiRouter.delete(
  "/:id",
  teamOwnerOrAdminValidator,
  idParamValidator,
  safeControllerFunction(RateCardController.deleteById)
);

export default ratecardApiRouter;
