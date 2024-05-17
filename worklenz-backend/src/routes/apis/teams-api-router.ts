import express from "express";

import TeamsController from "../../controllers/teams-controller";

import teamsActivateBodyValidator from "../../middlewares/validators/teams-activate-body-validator";
import safeControllerFunction from "../../shared/safe-controller-function";

const teamsApiRouter = express.Router();

teamsApiRouter.get("/", safeControllerFunction(TeamsController.get));
teamsApiRouter.get("/invites", safeControllerFunction(TeamsController.getTeamInvites));
teamsApiRouter.put("/activate", teamsActivateBodyValidator, safeControllerFunction(TeamsController.activate));
teamsApiRouter.put("/pik-name", safeControllerFunction(TeamsController.updateNameOnce));
teamsApiRouter.put("/", safeControllerFunction(TeamsController.update));
teamsApiRouter.post("/", safeControllerFunction(TeamsController.create));

export default teamsApiRouter;
