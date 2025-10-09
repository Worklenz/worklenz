import express from "express";
import rateLimit from "express-rate-limit";
import SlackController from "../../controllers/slack-controller";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import {
  slackOAuthValidator,
  channelSyncValidator,
  channelConfigValidator,
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
    message: 'Too many Slack API requests. Please try again later.',
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
  safeControllerFunction(SlackController.getStatus)
);

slackApiRouter.get(
  "/install-url",
  safeControllerFunction(SlackController.getInstallUrl)
);

slackApiRouter.delete(
  "/disconnect",
  safeControllerFunction(SlackController.disconnect)
);

slackApiRouter.get(
  "/channels",
  safeControllerFunction(SlackController.getAvailableChannels)
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
  channelConfigValidator,
  safeControllerFunction(SlackController.createChannelConfig)
);

slackApiRouter.patch(
  "/channel-configs/:configId",
  idParamValidator,
  safeControllerFunction(SlackController.updateChannelConfig)
);

slackApiRouter.delete(
  "/channel-configs/:configId",
  idParamValidator,
  safeControllerFunction(SlackController.deleteChannelConfig)
);

// Legacy routes for more specific queries
slackApiRouter.get(
  "/channel-configs/project/:projectId",
  idParamValidator,
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
    message: 'Too many test notification requests. Please wait before trying again.',
    body: null
  },
  standardHeaders: true,
  legacyHeaders: false,
});

slackApiRouter.post(
  "/test-notification/:configId",
  testNotificationLimiter,
  idParamValidator,
  testNotificationValidator,
  safeControllerFunction(SlackController.sendTestNotification)
);

export default slackApiRouter;
