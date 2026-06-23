import express from "express";

import CasesController from "../../controllers/cases-controller";
import safeControllerFunction from "../../shared/safe-controller-function";

const casesApiRouter = express.Router();

casesApiRouter.get("/", safeControllerFunction(CasesController.get));

export default casesApiRouter;
