import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";

/**
 * Checks if user has business plan access based on session data
 * Includes active business plan trials
 */
function hasBusinessPlanAccess(user: any): boolean {
  if (!user) {
    console.log("[BUSINESS_PLAN_CHECK] No user session - DENIED");
    return false;
  }

  console.log("[BUSINESS_PLAN_CHECK] Checking access for user:", {
    userId: user.id,
    subscriptionType: user.subscription_type,
    planName: user.plan_name,
    activePlanTrial: user.active_plan_trial,
    planTrialEndDate: user.plan_trial_end_date
  });

  const subscriptionType = user.subscription_type;
  const planName = (user.plan_name || "").toLowerCase();

  // Check for active Business plan trial (BUSINESS_LARGE tier)
  if (user.active_plan_trial === "BUSINESS_LARGE" && user.plan_trial_end_date) {
    const trialEndDate = new Date(user.plan_trial_end_date);
    if (trialEndDate > new Date()) {
      console.log("[BUSINESS_PLAN_CHECK] GRANTED - Active BUSINESS_LARGE trial");
      return true;
    }
    console.log("[BUSINESS_PLAN_CHECK] BUSINESS_LARGE trial expired");
  }

  // Check for Business trial subscription type (from deserialize_user)
  if (subscriptionType === "BUSINESS_TRIAL") {
    console.log("[BUSINESS_PLAN_CHECK] GRANTED - BUSINESS_TRIAL subscription type");
    return true;
  }

  // ANNUAL_BUSINESS subscription type qualifies
  if (subscriptionType === "ANNUAL_BUSINESS") {
    console.log("[BUSINESS_PLAN_CHECK] GRANTED - ANNUAL_BUSINESS subscription");
    return true;
  }

  // SELF_HOSTED users have business plan privileges
  if (subscriptionType === "SELF_HOSTED") {
    console.log("[BUSINESS_PLAN_CHECK] GRANTED - SELF_HOSTED subscription");
    return true;
  }

  // PADDLE subscription type with business or enterprise plan
  if (subscriptionType === "PADDLE") {
    const hasAccess = planName.includes("business") || planName.includes("enterprise");
    console.log("[BUSINESS_PLAN_CHECK] PADDLE subscription -", hasAccess ? "GRANTED" : "DENIED");
    return hasAccess;
  }

  console.log("[BUSINESS_PLAN_CHECK] DENIED - No matching criteria");
  return false;
}

/**
 * Middleware to require business plan for accessing certain features
 */
export const requireBusinessPlan = (
  req: IWorkLenzRequest,
  res: IWorkLenzResponse,
  next: () => void
) => {
  if (!req.user) {
    res.status(401).send(
      new ServerResponse(false, null, "Unauthorized")
    );
    return;
  }
  
  const hasAccess = hasBusinessPlanAccess(req.user);
  
  if (!hasAccess) {
    res.status(403).send(
      new ServerResponse(false, null, "This feature requires a Business plan")
    );
    return;
  }
  
  next();
};
