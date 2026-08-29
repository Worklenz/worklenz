import express from "express";
import SubscriptionController from "../../controllers/subscription-controller";
import teamOwnerOrAdminValidator from "../../../middlewares/validators/team-owner-or-admin-validator";

const subscriptionsApiRouter = express.Router();

// Subscription management
// Mutating actions are restricted to team owners/admins; any team member can view.
subscriptionsApiRouter.post("/", teamOwnerOrAdminValidator, SubscriptionController.createSubscription);
subscriptionsApiRouter.get("/current", SubscriptionController.getCurrentSubscription);
subscriptionsApiRouter.put("/upgrade", teamOwnerOrAdminValidator, SubscriptionController.upgradeSubscription);
subscriptionsApiRouter.get("/usage", SubscriptionController.getUsage);
subscriptionsApiRouter.post("/cancel", teamOwnerOrAdminValidator, SubscriptionController.cancelSubscription);

export default subscriptionsApiRouter;