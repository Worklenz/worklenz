import express from "express";
import ModerationController from "../../controllers/moderation-controller";
import safeControllerFunction from "../../shared/safe-controller-function";

const moderationApiRouter = express.Router();

// Admin-only routes for spam/abuse moderation
moderationApiRouter.get("/flagged-organizations", safeControllerFunction(ModerationController.getFlaggedOrganizations));
moderationApiRouter.post("/flag-organization", safeControllerFunction(ModerationController.flagOrganization));
moderationApiRouter.post("/suspend-organization", safeControllerFunction(ModerationController.suspendOrganization));
moderationApiRouter.post("/unsuspend-organization", safeControllerFunction(ModerationController.unsuspendOrganization));
moderationApiRouter.get("/scan-spam", safeControllerFunction(ModerationController.scanForSpam));
moderationApiRouter.get("/stats", safeControllerFunction(ModerationController.getModerationStats));
moderationApiRouter.post("/bulk-scan", safeControllerFunction(ModerationController.bulkScanAndFlag));

export default moderationApiRouter;