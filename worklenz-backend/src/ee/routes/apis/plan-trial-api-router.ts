import { Router } from "express";
import PlanTrialController from "../../controllers/plan-trial-controller";
import teamOwnerOrAdminValidator from "../../../middlewares/validators/team-owner-or-admin-validator";

const planTrialApiRouter = Router();

// Check Business plan trial eligibility
planTrialApiRouter.get("/business/trial/eligibility", PlanTrialController.checkBusinessTrialEligibility);

// Start Business plan trial
planTrialApiRouter.post("/business/trial", teamOwnerOrAdminValidator, PlanTrialController.startBusinessTrial);

// Get current trial status
planTrialApiRouter.get("/trial/status", PlanTrialController.getTrialStatus);

// Cancel active trial
planTrialApiRouter.post("/trial/cancel", teamOwnerOrAdminValidator, PlanTrialController.cancelTrial);

// Convert trial to paid subscription
planTrialApiRouter.post("/trial/convert", teamOwnerOrAdminValidator, PlanTrialController.convertTrial);

// Get trial statistics (admin only)
planTrialApiRouter.get("/trial/stats", PlanTrialController.getTrialStats);

export default planTrialApiRouter;