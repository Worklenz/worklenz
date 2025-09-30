import { Router } from "express";
import { SlackService } from "../services/slack/slack.service";
import { authMiddleware } from "../middlewares/auth";

const router = Router();
const slackService = new SlackService();


// Get Slack connection status for current team
router.get("/status", authMiddleware, async (req, res) => {
  try {
    const teamId = (req.user as Express.User | undefined)?.team_id;
    if (!teamId) {
      return res.status(400).json({ error: "Missing team context" });
    }
    const workspace = await slackService.getWorkspaceByTeamId(teamId);

    res.json({
      connected: !!workspace,
      workspace: workspace
        ? {
            name: workspace.slack_team_name,
            id: workspace.slack_team_id,
          }
        : null,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to get Slack status" });
  }
});

// Generate installation URL
router.get("/install-url", authMiddleware, async (req, res) => {
  try {
    const user = req.user as Express.User | undefined;
    const teamId = user?.team_id;
    const userId = user?.id;
    if (!teamId || !userId) {
      return res.status(400).json({ error: "Missing user/team context" });
    }
    const installUrl = slackService.generateInstallUrl(teamId, userId);

    res.json({ url: installUrl });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate install URL" });
  }
});

// OAuth callback
router.get("/oauth/callback", async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    // User denied the installation
    res.redirect(
      `${process.env.FRONTEND_URL}/settings/integrations?slack=cancelled`
    );
    return;
  }

  try {
    const result = await slackService.handleOAuthCallback(
      code as string,
      state as string
    );

    // Redirect to success page in frontend
    res.redirect(
      `${process.env.FRONTEND_URL}/settings/integrations?slack=success`
    );
  } catch (error) {
    console.error("OAuth callback error:", error);
    res.redirect(
      `${process.env.FRONTEND_URL}/settings/integrations?slack=error`
    );
  }
});

// Disconnect Slack
router.delete("/disconnect", authMiddleware, async (req, res) => {
  try {
    const teamId = (req.user as Express.User | undefined)?.team_id;
    if (!teamId) {
      return res.status(400).json({ error: "Missing team context" });
    }
    await slackService.disconnectWorkspace(teamId);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to disconnect Slack" });
  }
});

// Get available channels
router.get("/channels", authMiddleware, async (req, res) => {
  try {
    const teamId = (req.user as Express.User | undefined)?.team_id;
    if (!teamId) {
      return res.status(400).json({ error: "Missing team context" });
    }
    const channels = await slackService.getAvailableChannels(teamId);

    res.json(channels);
  } catch (error) {
    res.status(500).json({ error: "Failed to get channels" });
  }
});

// Get saved channel configurations (e.g. default channel mapping for a team)
router.get("/channel-configs", authMiddleware, async (req, res) => {
  try {
    const teamId = (req.user as Express.User | undefined)?.team_id;
    if (!teamId) {
      return res.status(400).json({ error: "Missing team context" });
    }

    // Fetch channel configs from SlackService (or DB)
    const configs = await slackService.getChannelConfigs(teamId);

    res.json(configs || []);
  } catch (error) {
    console.error("Failed to get channel configs:", error);
    res.status(500).json({ error: "Failed to get channel configs" });
  }
});

// Create a channel configuration
router.post("/channel-configs", authMiddleware, async (req, res) => {
  try {
    const teamId = (req.user as Express.User | undefined)?.team_id;
    if (!teamId) {
      return res.status(400).json({ error: "Missing team context" });
    }

    const { projectId, slackChannelId, notificationTypes } = req.body || {};
    if (!projectId || !slackChannelId || !Array.isArray(notificationTypes)) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const created = await slackService.createChannelConfig(teamId, {
      projectId,
      slackChannelId,
      notificationTypes,
    });

    if (!created) return res.status(500).json({ error: "Failed to create config" });

    res.json(created);
  } catch (error) {
    res.status(500).json({ error: "Failed to create channel configuration" });
  }
});

// Aliases for legacy frontend URLs mounted under /api/integrations/slack
router.post("/channels", authMiddleware, async (req, res) => {
  // Delegate to channel-configs create
  return (router as any).handle({
    ...req,
    url: "/channel-configs",
    method: "POST"
  }, res);
});

// Update a channel configuration
router.patch("/channel-configs/:id", authMiddleware, async (req, res) => {
  try {
    const teamId = (req.user as Express.User | undefined)?.team_id;
    if (!teamId) {
      return res.status(400).json({ error: "Missing team context" });
    }

    const { id } = req.params;
    const { isActive, notificationTypes } = req.body || {};

    const ok = await slackService.updateChannelConfig(teamId, id, {
      isActive,
      notificationTypes,
    });

    if (!ok) return res.status(500).json({ error: "Failed to update config" });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update channel configuration" });
  }
});

router.patch("/channels/:id", authMiddleware, async (req, res) => {
  // Delegate to channel-configs update
  return (router as any).handle({
    ...req,
    url: `/channel-configs/${req.params.id}`,
    method: "PATCH"
  }, res);
});

// Delete a channel configuration
router.delete("/channel-configs/:id", authMiddleware, async (req, res) => {
  try {
    const teamId = (req.user as Express.User | undefined)?.team_id;
    if (!teamId) {
      return res.status(400).json({ error: "Missing team context" });
    }

    const { id } = req.params;
    const ok = await slackService.deleteChannelConfig(teamId, id);
    if (!ok) return res.status(500).json({ error: "Failed to delete config" });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete channel configuration" });
  }
});

router.delete("/channels/:id", authMiddleware, async (req, res) => {
  // Delegate to channel-configs delete
  return (router as any).handle({
    ...req,
    url: `/channel-configs/${req.params.id}`,
    method: "DELETE"
  }, res);
});


// Slash commands
router.post("/commands", async (req, res) => {
  await slackService.handleSlashCommand(req, res);
});

// Event subscriptions
router.post("/events", async (req, res) => {
  // Slack URL verification
  if (req.body.type === "url_verification") {
    res.json({ challenge: req.body.challenge });
    return;
  }

  // Handle events
  // Implementation for handling different event types
  res.status(200).send();
});

// Interactive components (buttons, menus, etc.)
router.post("/interactive", async (req, res) => {
  const payload = JSON.parse(req.body.payload);
  // Handle interactive components
  res.status(200).send();
});

export default router;
