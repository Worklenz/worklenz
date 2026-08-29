import express from "express";
import ClientsController from "../../controllers/clients-controller";
import SlackController from "../../ee/controllers/slack-controller";
import DigestPreferencesController from "../../controllers/digest-preferences-controller";
import safeControllerFunction from "../../shared/safe-controller-function";

const public_router = express.Router();

public_router.post("/new-subscriber", safeControllerFunction(ClientsController.addSubscriber));
public_router.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

// Slack OAuth callback (public - no authentication required)
public_router.get("/slack/oauth/callback", safeControllerFunction(SlackController.oauthCallback));

// Digest email unsubscribe (public - no authentication required)
public_router.get("/digest/unsubscribe", DigestPreferencesController.unsubscribe);

export default public_router;
