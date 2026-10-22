import express from "express";
import rateLimit from "express-rate-limit";
import TeamsWebhookController from "../../controllers/teams-webhook-controller";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import projectIdParamValidator from "../../middlewares/validators/project-id-param-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import { requireFeature } from "../../shared/entitlements/gates";

const teamsWebhookApiRouter = express.Router();

teamsWebhookApiRouter.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { done: false, message: "Too many Teams API requests. Please try again later.", body: null },
  standardHeaders: true,
  legacyHeaders: false,
}));

const testLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { done: false, message: "Too many test notification requests. Please wait before trying again.", body: null },
  standardHeaders: true,
  legacyHeaders: false,
});

teamsWebhookApiRouter.get(
  "/project/:projectId",
  requireFeature("teams_integration"),
  projectIdParamValidator,
  safeControllerFunction(TeamsWebhookController.getByProject)
);

teamsWebhookApiRouter.post(
  "/",
  requireFeature("teams_integration"),
  safeControllerFunction(TeamsWebhookController.create)
);

teamsWebhookApiRouter.patch(
  "/:id",
  requireFeature("teams_integration"),
  idParamValidator,
  safeControllerFunction(TeamsWebhookController.update)
);

teamsWebhookApiRouter.delete(
  "/:id",
  idParamValidator,
  safeControllerFunction(TeamsWebhookController.remove)
);

teamsWebhookApiRouter.post(
  "/:id/test",
  testLimiter,
  requireFeature("teams_integration"),
  idParamValidator,
  safeControllerFunction(TeamsWebhookController.sendTest)
);

export default teamsWebhookApiRouter;
