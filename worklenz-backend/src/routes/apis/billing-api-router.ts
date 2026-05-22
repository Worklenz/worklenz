import express from "express";

import BillingController from "../../controllers/billing-controller";

const billingApiRouter = express.Router();

billingApiRouter.get("/upgrade-to-paid-plan", BillingController.upgradeToPaidPlan);
billingApiRouter.post("/purchase-more-seats", BillingController.addMoreSeats);

billingApiRouter.get("/contact-us", BillingController.contactUs);
billingApiRouter.get("/pricing-plans", BillingController.getPricingPlans);
billingApiRouter.get("/check-region", BillingController.checkRegion);
billingApiRouter.get("/lkr-pricing", BillingController.getLkrPricing);

// DirectPay Tokenization APIs
billingApiRouter.post("/directpay/create-card-session", BillingController.createCardAddSession);
billingApiRouter.post("/directpay/create-token-payment-session", BillingController.createCardTokenPaymentSession);
billingApiRouter.get("/directpay/list-cards", BillingController.listCards);
billingApiRouter.post("/directpay/delete-card", BillingController.deleteCard);
billingApiRouter.post("/directpay/pay-with-card", BillingController.payWithCard);
billingApiRouter.post("/directpay/save-card-response", BillingController.saveDirectPayCardResponse);
// Note: DirectPay card-response webhook is mounted at app level (/webhook/directpay/card-response)
// to bypass auth/CSRF since it's called by DirectPay's server, not the browser.

export default billingApiRouter;
