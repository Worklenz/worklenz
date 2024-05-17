import express from "express";

import ClientsController from "../../controllers/clients-controller";

import clientsBodyValidator from "../../middlewares/validators/clients-body-validator";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import teamOwnerOrAdminValidator from "../../middlewares/validators/team-owner-or-admin-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import projectManagerValidator from "../../middlewares/validators/project-manager-validator";

const clientsApiRouter = express.Router();

clientsApiRouter.post("/", projectManagerValidator, clientsBodyValidator, safeControllerFunction(ClientsController.create));
clientsApiRouter.get("/", safeControllerFunction(ClientsController.get));
clientsApiRouter.get("/:id", teamOwnerOrAdminValidator, idParamValidator, safeControllerFunction(ClientsController.getById));
clientsApiRouter.put("/:id", teamOwnerOrAdminValidator, clientsBodyValidator, idParamValidator, safeControllerFunction(ClientsController.update));
clientsApiRouter.delete("/:id", teamOwnerOrAdminValidator, idParamValidator, safeControllerFunction(ClientsController.deleteById));

export default clientsApiRouter;
