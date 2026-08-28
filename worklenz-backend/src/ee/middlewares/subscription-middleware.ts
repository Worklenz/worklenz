import { NextFunction, Request, Response } from "express";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { checkTeamSubscriptionStatus } from "../shared/paddle-utils";

/**
 * Checks if user has business plan access based on session data
 * Includes active business plan trials, manual overrides, and AppSumo eligibility
 */
export function hasBusinessPlanAccess(user: any): boolean {
  if (!user) {
    return false;
  }

  const isTruthy = (value: unknown): boolean =>
    value === true || value === 1 || value === "true" || value === "t";

  // PRIORITY 1: Manual override flag (highest priority)
  if (isTruthy(user.business_plan_override)) {
    return true;
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

/**
 * Middleware to require business plan for team-scoped requests that authenticate via
 * x-client-token rather than a passport session (e.g. the client portal), where
 * req.user is never populated. Resolves the organization's plan from req.organizationId,
 * which client-auth-middleware sets to the client's team_id.
 */
export const requireBusinessPlanForOrganization = async (
  req: Request & { organizationId?: string },
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  const teamId = req.organizationId;

  if (!teamId) {
    return res.status(401).send(
      new ServerResponse(false, null, "Unauthorized")
    );
  }

  const subscriptionData = await checkTeamSubscriptionStatus(teamId);

  if (!subscriptionData || !hasBusinessPlanAccess(subscriptionData)) {
    return res.status(403).send(
      new ServerResponse(false, null, "This feature requires a Business plan")
    );
  }

  return next();
};

/**
 * Checks if a subscription restricts Pro Plan features (like project health, billable)
 * Returns true if the user should be restricted (Pro Plan or AppSumo users)
 */
export async function isRestrictedFromProPlanFeatures(teamId: string | null | undefined): Promise<boolean> {
  if (!teamId) {
    return true; // Restrict if no team_id
  }

  const subscriptionData = await checkTeamSubscriptionStatus(teamId);
  
  if (!subscriptionData) {
    return true; // Restrict if subscription data not found
  }

  // Check if user is on Pro Plan
  const isProPlan = subscriptionData.subscription_type === "PADDLE" &&
                   subscriptionData.plan_name?.toLowerCase().includes('pro');

  // Check if user is on AppSumo/Lifetime Deal (an active Business trial overrides this)
  const isAppSumo = subscriptionData.is_ltd === true && subscriptionData.subscription_type !== "BUSINESS_TRIAL";

  return isProPlan || isAppSumo;
}

/**
 * Middleware to restrict Pro Plan features (project health, billable, etc.)
 * Pro Plan and AppSumo users are restricted from these features
 */
export const restrictProPlanFeatures = async (
  req: IWorkLenzRequest,
  res: IWorkLenzResponse,
  next: NextFunction
): Promise<IWorkLenzResponse | void> => {
  if (!req.user?.team_id) {
    return res.status(200).send(
      new ServerResponse(false, null, "Required fields are missing.")
    );
  }

  const isRestricted = await isRestrictedFromProPlanFeatures(req.user.team_id);
  
  if (isRestricted) {
    return res.status(200).send(
      new ServerResponse(
        false, 
        null, 
        "This feature is not available for Pro Plan and AppSumo users. Please upgrade to Business plan to access this feature."
      )
    );
  }
  
  return next();
};
