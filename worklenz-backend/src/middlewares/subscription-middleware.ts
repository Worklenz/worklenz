import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";

/**
 * Checks if user has business plan access based on session data
 * Includes active business plan trials
 */
function hasBusinessPlanAccess(user: any): boolean {
  if (!user) {
    return false;
  }

  const subscriptionType = user.subscription_type;
  const planName = (user.plan_name || "").toLowerCase();

  // Check for active Business plan trial (BUSINESS_LARGE tier)
  if (user.active_plan_trial === "BUSINESS_LARGE" && user.plan_trial_end_date) {
    const trialEndDate = new Date(user.plan_trial_end_date);
    if (trialEndDate > new Date()) {
      return true;
    }
  }

  // Check for Business trial subscription type (from deserialize_user)
  if (subscriptionType === "BUSINESS_TRIAL") {
    return true;
  }

  // ANNUAL_BUSINESS subscription type qualifies
  if (subscriptionType === "ANNUAL_BUSINESS") {
    return true;
  }

  // SELF_HOSTED users have business plan privileges
  if (subscriptionType === "SELF_HOSTED") {
    return true;
  }

  // PADDLE subscription type with business or enterprise plan
  if (subscriptionType === "PADDLE") {
    const hasAccess = planName.includes("business") || planName.includes("enterprise");
    return hasAccess;
  }

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
