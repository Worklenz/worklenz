import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import db from "../config/db";

/**
 * Checks if organization has business plan access
 * Includes active business plan trials
 */
async function hasBusinessPlanAccess(organizationId: string): Promise<boolean> {
  try {
    console.log("[BUSINESS_PLAN_CHECK] Checking access for organization:", organizationId);
    
    const query = `
      WITH org_data AS (
        SELECT 
          o.id,
          o.user_id,
          slt.key AS subscription_type,
          lpp.name AS plan_name
        FROM organizations o
        LEFT JOIN licensing_subscription_types slt ON o.license_type_id = slt.id
        LEFT JOIN licensing_user_subscriptions lus ON o.user_id = lus.user_id AND lus.active = TRUE
        LEFT JOIN licensing_pricing_plans lpp ON lus.plan_id = lpp.id
        WHERE o.id = $1
      ),
      trial_data AS (
        SELECT
          lpt.tier_name AS active_plan_trial,
          lpt.trial_end_date AS plan_trial_end_date
        FROM org_data od
        INNER JOIN licensing_plan_trials lpt ON od.user_id = lpt.user_id
        WHERE lpt.is_active = TRUE
          AND lpt.trial_end_date > NOW()
        LIMIT 1
      )
      SELECT 
        od.subscription_type,
        od.plan_name,
        td.active_plan_trial,
        td.plan_trial_end_date
      FROM org_data od
      LEFT JOIN trial_data td ON TRUE
    `;
    const result = await db.query(query, [organizationId]);
    
    console.log("[BUSINESS_PLAN_CHECK] Query result rows:", result.rows.length);
    
    if (result.rows.length === 0) {
      console.log("[BUSINESS_PLAN_CHECK] No organization data found - DENIED");
      return false;
    }
    
    const [org] = result.rows;
    const subscriptionType = org.subscription_type;
    const planName = (org.plan_name || "").toLowerCase();
    
    console.log("[BUSINESS_PLAN_CHECK] Organization data:", {
      subscriptionType,
      planName,
      activePlanTrial: org.active_plan_trial,
      planTrialEndDate: org.plan_trial_end_date
    });
    
    // Check for active Business plan trial (BUSINESS_LARGE tier)
    if (org.active_plan_trial === "BUSINESS_LARGE" && org.plan_trial_end_date) {
      const trialEndDate = new Date(org.plan_trial_end_date);
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
  } catch (error) {
    // Log error silently - don't expose internal errors
    console.error("Error checking business plan access:", error);
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
