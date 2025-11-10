import express from "express";
import ClientsController from "../../controllers/clients-controller";
import SlackController from "../../controllers/slack-controller";
import safeControllerFunction from "../../shared/safe-controller-function";

const public_router = express.Router();

public_router.post("/new-subscriber", safeControllerFunction(ClientsController.addSubscriber));
public_router.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

// Slack OAuth callback (public - no authentication required)
public_router.get("/slack/oauth/callback", safeControllerFunction(SlackController.oauthCallback));

export default public_router;
