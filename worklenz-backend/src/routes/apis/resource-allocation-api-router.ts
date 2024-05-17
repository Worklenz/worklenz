import express from "express";

import ResourceallocationController from "../../controllers/resource-allocation-controller";
import safeControllerFunction from "../../shared/safe-controller-function";

const resourceAllocationApiRouter = express.Router();

resourceAllocationApiRouter.get("/project", safeControllerFunction(ResourceallocationController.getProjectWiseResources));
resourceAllocationApiRouter.get("/team", safeControllerFunction(ResourceallocationController.getUserWiseResources));

export default resourceAllocationApiRouter;
