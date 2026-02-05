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
billingApiRouter.get("/check-region", BillingController.checkRegion);
billingApiRouter.get("/lkr-pricing", BillingController.getLkrPricing);

// DirectPay Tokenization APIs
billingApiRouter.post("/directpay/create-card-session", BillingController.createCardAddSession);
billingApiRouter.get("/directpay/list-cards", BillingController.listCards);
billingApiRouter.post("/directpay/delete-card", BillingController.deleteCard);
billingApiRouter.post("/directpay/pay-with-card", BillingController.payWithCard);
billingApiRouter.post("/directpay-card-response", BillingController.handleCardAddResponse);

export default billingApiRouter;