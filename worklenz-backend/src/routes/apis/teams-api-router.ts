import express from "express";

import TeamsController from "../../controllers/teams-controller";
import GuestSeatController from "../../controllers/guest-seat-controller";

import teamsActivateBodyValidator from "../../middlewares/validators/teams-activate-body-validator";
import { manageTeamsValidator } from "../../middlewares/validators/organization-permission-validator";
import safeControllerFunction from "../../shared/safe-controller-function";

const teamsApiRouter = express.Router();

teamsApiRouter.get("/", safeControllerFunction(TeamsController.get));
teamsApiRouter.get("/invites", safeControllerFunction(TeamsController.getTeamInvites));
teamsApiRouter.get("/guest-usage", safeControllerFunction(GuestSeatController.getUsage));
teamsApiRouter.put("/activate", teamsActivateBodyValidator, safeControllerFunction(TeamsController.activate));
teamsApiRouter.put("/", safeControllerFunction(TeamsController.update));
teamsApiRouter.post("/", manageTeamsValidator, safeControllerFunction(TeamsController.create));

export default teamsApiRouter;
