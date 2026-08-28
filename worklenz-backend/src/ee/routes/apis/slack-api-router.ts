import express from "express";
import rateLimit from "express-rate-limit";
import SlackController from "../../controllers/slack-controller";
import idParamValidator from "../../../middlewares/validators/id-param-validator";
import configIdParamValidator from "../../../middlewares/validators/config-id-param-validator";
import projectIdParamValidator from "../../../middlewares/validators/project-id-param-validator";
import safeControllerFunction from "../../../shared/safe-controller-function";
import { requireBusinessPlan } from "../../middlewares/subscription-middleware";
import {
  slackOAuthValidator,
  channelSyncValidator,
  channelConfigValidator,
  channelConfigUpdateValidator,
  testNotificationValidator
} from "../../middlewares/validators/slack-validators";

const slackApiRouter = express.Router();

// Rate limiting specifically for Slack endpoints
// More restrictive to prevent abuse
const slackRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: {
    done: false,
    message: "Too many Slack API requests. Please try again later.",
    body: null
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all Slack routes
slackApiRouter.use(slackRateLimiter);

// Status and setup routes (simple endpoints matching frontend expectations)
slackApiRouter.get(
  "/status",
  requireBusinessPlan,
  safeControllerFunction(SlackController.getStatus)
);

slackApiRouter.get(
  "/install-url",
  requireBusinessPlan,
  safeControllerFunction(SlackController.getInstallUrl)
);

slackApiRouter.get(
  "/oauth/callback",
  safeControllerFunction(SlackController.oauthCallback)
);

slackApiRouter.delete(
  "/disconnect",
  requireBusinessPlan,
  safeControllerFunction(SlackController.disconnect)
);

slackApiRouter.get(
  "/channels",
  requireBusinessPlan,
  safeControllerFunction(SlackController.getAvailableChannels)
);

slackApiRouter.post(
  "/channels/refresh",
  requireBusinessPlan,
  safeControllerFunction(SlackController.refreshChannels)
);

// Workspace routes (legacy - for direct workspace management)
slackApiRouter.post(
  "/workspace/connect",
  slackOAuthValidator,
  safeControllerFunction(SlackController.connectWorkspace)
);

slackApiRouter.get(
  "/workspace",
  safeControllerFunction(SlackController.getWorkspace)
);

slackApiRouter.delete(
  "/workspace/:workspaceId",
  idParamValidator,
  safeControllerFunction(SlackController.disconnectWorkspace)
);

// Channel routes
slackApiRouter.post(
  "/workspace/:workspaceId/channels/sync",
  idParamValidator,
  channelSyncValidator,
  safeControllerFunction(SlackController.syncChannels)
);

slackApiRouter.get(
  "/workspace/:workspaceId/channels",
  idParamValidator,
  safeControllerFunction(SlackController.getChannels)
);

// Channel configuration routes (simplified for frontend)
slackApiRouter.get(
  "/channel-configs",
  safeControllerFunction(SlackController.getAllChannelConfigs)
);

slackApiRouter.post(
  "/channel-configs",
  requireBusinessPlan,
  channelConfigValidator,
  safeControllerFunction(SlackController.createChannelConfig)
);

slackApiRouter.patch(
  "/channel-configs/:configId",
  configIdParamValidator,
  channelConfigUpdateValidator,
  safeControllerFunction(SlackController.updateChannelConfig)
);

slackApiRouter.delete(
  "/channel-configs/:configId",
  configIdParamValidator,
  safeControllerFunction(SlackController.deleteChannelConfig)
);

slackApiRouter.post(
  "/channel-configs/:configId/reactivate",
  configIdParamValidator,
  safeControllerFunction(SlackController.reactivateChannelConfig)
);

// Legacy routes for more specific queries
slackApiRouter.get(
  "/channel-configs/project/:projectId",
  requireBusinessPlan,
  projectIdParamValidator,
  safeControllerFunction(SlackController.getProjectChannelConfigs)
);

slackApiRouter.get(
  "/channel-configs/organization",
  safeControllerFunction(SlackController.getOrganizationChannelConfigs)
);

// Test notification - extra rate limiting
const testNotificationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 test notifications per minute
  message: {
    done: false,
    message: "Too many test notification requests. Please wait before trying again.",
    body: null
  },
  standardHeaders: true,
  legacyHeaders: false,
});

slackApiRouter.post(
  "/test-notification/:configId",
  testNotificationLimiter,
  configIdParamValidator,
  testNotificationValidator,
  safeControllerFunction(SlackController.sendTestNotification)
);

// Channel joining routes
slackApiRouter.post(
  "/channels/join",
  safeControllerFunction(SlackController.joinChannel)
);

slackApiRouter.post(
  "/workspace/:workspaceId/channels/auto-join",
  idParamValidator,
  safeControllerFunction(SlackController.autoJoinPublicChannels)
);

export default slackApiRouter;
