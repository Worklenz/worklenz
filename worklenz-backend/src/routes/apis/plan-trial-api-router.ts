import { Router } from "express";
import PlanTrialController from "../../controllers/plan-trial-controller";

const planTrialApiRouter = Router();

// Check Business plan trial eligibility
planTrialApiRouter.get("/business/trial/eligibility", PlanTrialController.checkBusinessTrialEligibility);

// Start Business plan trial
planTrialApiRouter.post("/business/trial", PlanTrialController.startBusinessTrial);

// Get current trial status
planTrialApiRouter.get("/trial/status", PlanTrialController.getTrialStatus);

// Cancel active trial
planTrialApiRouter.post("/trial/cancel", PlanTrialController.cancelTrial);

// Convert trial to paid subscription
planTrialApiRouter.post("/trial/convert", PlanTrialController.convertTrial);

// Get trial statistics (admin only)
planTrialApiRouter.get("/trial/stats", PlanTrialController.getTrialStats);

export default planTrialApiRouter;