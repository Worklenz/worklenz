import express from "express";
import OnboardingController from "../../controllers/onboarding-controller";
import safeControllerFunction from "../../shared/safe-controller-function";

const onboardingApiRouter = express.Router();

onboardingApiRouter.post(
  "/account-setup",
  safeControllerFunction(OnboardingController.setupAccountFromTemplate),
);

export default onboardingApiRouter;
