import express from "express";

import TeamDocumentsController from "../../controllers/team-documents-controller";
import safeControllerFunction from "../../shared/safe-controller-function";

const teamDocumentsApiRouter = express.Router();

teamDocumentsApiRouter.get("/search", safeControllerFunction(TeamDocumentsController.search));
teamDocumentsApiRouter.get("/favorites", safeControllerFunction(TeamDocumentsController.favorites));
teamDocumentsApiRouter.get("/", safeControllerFunction(TeamDocumentsController.list));

export default teamDocumentsApiRouter;
