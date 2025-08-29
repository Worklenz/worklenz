import express from "express";

import BillingController from "../../controllers/billing-controller";

const billingApiRouter = express.Router();

billingApiRouter.get("/upgrade-to-paid-plan", BillingController.upgradeToPaidPlan);
billingApiRouter.post("/purchase-more-seats", BillingController.addMoreSeats);

billingApiRouter.get("/get-direct-pay-data", BillingController.getDirectPayObject);
billingApiRouter.post("/save-transaction-data", BillingController.saveTransactionData);
billingApiRouter.get("/get-card-list", BillingController.getCardList);
billingApiRouter.get("/contact-us", BillingController.contactUs);
billingApiRouter.get("/pricing-plans", BillingController.getPricingPlans);

export default billingApiRouter;