import express from "express";
import SubscriptionController from "../../ee/controllers/subscription-controller";

const plansApiRouter = express.Router();

// Plans listing with user-specific pricing
plansApiRouter.get("/", SubscriptionController.listPlans);

export default plansApiRouter;