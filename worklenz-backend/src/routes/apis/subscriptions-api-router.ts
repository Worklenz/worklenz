import express from "express";
import SubscriptionController from "../../controllers/subscription-controller";

const subscriptionsApiRouter = express.Router();

// Subscription management
subscriptionsApiRouter.post("/", SubscriptionController.createSubscription);
subscriptionsApiRouter.get("/current", SubscriptionController.getCurrentSubscription);
subscriptionsApiRouter.put("/upgrade", SubscriptionController.upgradeSubscription);
subscriptionsApiRouter.get("/usage", SubscriptionController.getUsage);
subscriptionsApiRouter.post("/cancel", SubscriptionController.cancelSubscription);

export default subscriptionsApiRouter;