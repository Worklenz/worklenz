import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import db from "../config/db";

/**
 * Checks if organization has business plan access
 */
async function hasBusinessPlanAccess(organizationId: string): Promise<boolean> {
  try {
    const query = `
      SELECT subscription_type, plan_name, active_plan_trial, plan_trial_end_date
      FROM organizations
      WHERE id = $1
    `;
    const result = await db.query(query, [organizationId]);
    
    if (result.rows.length === 0) {
      return false;
    }
    
    const [org] = result.rows;
    const subscriptionType = org.subscription_type;
    const planName = (org.plan_name || "").toLowerCase();
    
    // ANNUAL_BUSINESS subscription type qualifies
    if (subscriptionType === "ANNUAL_BUSINESS") {
      return true;
    }
    
    // SELF_HOSTED users have business plan privileges
    if (subscriptionType === "SELF_HOSTED") {
      return true;
    }
    
    // Check for active Business plan trial
    if (org.active_plan_trial === "BUSINESS_LARGE" && org.plan_trial_end_date) {
      const trialEndDate = new Date(org.plan_trial_end_date);
      if (trialEndDate > new Date()) {
        return true;
      }
    }
    
    // Check for Business trial subscription type
    if (subscriptionType === "BUSINESS_TRIAL") {
      return true;
    }
    
    // PADDLE subscription type with business or enterprise plan
    if (subscriptionType === "PADDLE") {
      return planName.includes("business") || planName.includes("enterprise");
    }
    
    return false;
  } catch (error) {
    // Log error silently - don't expose internal errors
    return false;
  }
}

/**
 * Middleware to require business plan for accessing certain features
 */
export const requireBusinessPlan = async (
  req: IWorkLenzRequest,
  res: IWorkLenzResponse,
  next: () => void
) => {
  const organizationId = req.user?.organization_id;
  
  if (!organizationId) {
    res.status(401).send(
      new ServerResponse(false, null, "Unauthorized: Organization ID required")
    );
    return;
  }
  
  const hasAccess = await hasBusinessPlanAccess(organizationId);
  
  if (!hasAccess) {
    res.status(403).send(
      new ServerResponse(false, null, "This feature requires a Business plan")
    );
    return;
  }
  
  next();
};
