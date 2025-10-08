import express from "express";
import SlackController from "../../controllers/slack-controller";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import safeControllerFunction from "../../shared/safe-controller-function";

const slackApiRouter = express.Router();

// Workspace routes
slackApiRouter.post("/workspace/connect", safeControllerFunction(SlackController.connectWorkspace));
slackApiRouter.get("/workspace", safeControllerFunction(SlackController.getWorkspace));
slackApiRouter.delete("/workspace/:workspaceId", idParamValidator, safeControllerFunction(SlackController.disconnectWorkspace));

// Channel routes
slackApiRouter.post("/workspace/:workspaceId/channels/sync", idParamValidator, safeControllerFunction(SlackController.syncChannels));
slackApiRouter.get("/workspace/:workspaceId/channels", idParamValidator, safeControllerFunction(SlackController.getChannels));

// Channel configuration routes
slackApiRouter.post("/channel-configs", safeControllerFunction(SlackController.createChannelConfig));
slackApiRouter.get("/channel-configs/project/:projectId", idParamValidator, safeControllerFunction(SlackController.getProjectChannelConfigs));
slackApiRouter.get("/channel-configs/organization", safeControllerFunction(SlackController.getOrganizationChannelConfigs));
slackApiRouter.delete("/channel-configs/:configId", idParamValidator, safeControllerFunction(SlackController.deleteChannelConfig));

// Test notification
slackApiRouter.post("/test-notification/:configId", idParamValidator, safeControllerFunction(SlackController.sendTestNotification));

export default slackApiRouter;
