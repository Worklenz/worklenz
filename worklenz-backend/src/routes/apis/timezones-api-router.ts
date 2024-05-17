import express from "express";

import TimezonesController from "../../controllers/timezones-controller";
import safeControllerFunction from "../../shared/safe-controller-function";

const timezonesApiRouter = express.Router();

timezonesApiRouter.get("/", safeControllerFunction(TimezonesController.get));
timezonesApiRouter.put("/", safeControllerFunction(TimezonesController.update));

export default timezonesApiRouter;
