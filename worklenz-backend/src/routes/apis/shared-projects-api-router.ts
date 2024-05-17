import express from "express";

import SharedprojectsController from "../../controllers/shared-projects-controller";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import sharedProjectsCreateValidator from "../../middlewares/validators/shared-projects-create-validator";
import safeControllerFunction from "../../shared/safe-controller-function";

const sharedProjectsApiRouter = express.Router();

sharedProjectsApiRouter.post("/", sharedProjectsCreateValidator, safeControllerFunction(SharedprojectsController.create)); // create link
sharedProjectsApiRouter.get("/:id", idParamValidator, safeControllerFunction(SharedprojectsController.getById)); // get by project id
sharedProjectsApiRouter.delete("/:id", idParamValidator, safeControllerFunction(SharedprojectsController.deleteById)); // disable link

export default sharedProjectsApiRouter;
