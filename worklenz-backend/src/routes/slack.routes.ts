import { Router } from "express";
import { SlackService } from "../services/slack/slack.service";
import { authMiddleware } from "../middlewares/auth";


const router = Router();
const slackService = new SlackService();


// Get Slack connection status for current team
router.get("/status", authMiddleware, async (req, res) => {
  try {
    const teamId = req.user.teamId;
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
    const teamId = req.user.teamId;
    const userId = req.user.id;
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
    const teamId = req.user.teamId;
    await slackService.disconnectWorkspace(teamId);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to disconnect Slack" });
  }
});

// Get available channels
router.get("/channels", authMiddleware, async (req, res) => {
  try {
    const teamId = req.user.teamId;
    const channels = await slackService.getAvailableChannels(teamId);

    res.json(channels);
  } catch (error) {
    res.status(500).json({ error: "Failed to get channels" });
  }
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
