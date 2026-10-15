import { NextFunction, Request, Response } from "express";
import { isSelfHostedDeployment } from "../deployment-mode";
import { hasBusinessPlanAccess } from "../../middlewares/subscription-middleware";
import { checkTeamSubscriptionStatus } from "../../shared/paddle-utils";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { FEATURE_REGISTRY, FeatureKey } from "./feature-registry";
import { hasFeature, resolveEntitlements, tierAtLeast } from "./resolve-entitlements";

/**
 * Feature gates. Routes and controllers ask "can this account use <feature>?" instead of
 * inspecting subscription_type / plan_name.
 *
 * ENTITLEMENTS_ENFORCE=on  -> decisions come from the entitlements registry
 * otherwise (default)       -> decisions replicate the legacy checks, so introducing the gates
 *                             changes nothing until the flag is flipped after shadow review.
 */

export function isEnforceMode(): boolean {
  return (process.env.ENTITLEMENTS_ENFORCE ?? "off").toLowerCase() === "on";
}

/**
 * Legacy-equivalent decision. Before the registry only Business-tier features were gated (by
 * hasBusinessPlanAccess); everything else was open.
 */
function legacyAllows(feature: FeatureKey, subscriptionData: any): boolean {
  return FEATURE_REGISTRY[feature].minTier === "business" ? hasBusinessPlanAccess(subscriptionData) : true;
}

/** Can a session user / subscription-status row use the feature? */
export function canUseFeature(subscriptionData: any, feature: FeatureKey): boolean {
  if (!subscriptionData) return false;
  if (isEnforceMode()) return hasFeature(resolveEntitlements(subscriptionData), feature);
  return legacyAllows(feature, subscriptionData);
}

/**
 * Team-scoped check for controllers that only have a team id. Pass `legacy` when the old check
 * differs from "Business-only", so default (non-enforce) behavior is preserved exactly.
 */
export async function teamCanUseFeature(
  teamId: string | null | undefined,
  feature: FeatureKey,
  legacy?: (subscriptionData: any) => boolean | Promise<boolean>,
): Promise<boolean> {
  if (!teamId) return false;
  const subscriptionData = await checkTeamSubscriptionStatus(teamId);
  if (!subscriptionData) return false;
  if (!isEnforceMode() && legacy) return legacy(subscriptionData);
  return canUseFeature(subscriptionData, feature);
}

function upgradeMessage(feature: FeatureKey): string {
  const tier = FEATURE_REGISTRY[feature].minTier;
  const label = tier.charAt(0).toUpperCase() + tier.slice(1);
  return `This feature requires a ${label} plan`;
}

/** Express middleware for session-authenticated routes (replaces requireBusinessPlan). */
export const requireFeature = (feature: FeatureKey) =>
  (req: IWorkLenzRequest, res: IWorkLenzResponse, next: () => void): void => {
    if (!req.user) {
      res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
      return;
    }
    if (!canUseFeature(req.user, feature)) {
      res.status(403).send(new ServerResponse(false, null, upgradeMessage(feature)));
      return;
    }
    next();
  };

/** Like requireFeature, but passes when the plan grants at least one of the features. */
export const requireAnyFeature = (features: FeatureKey[]) =>
  (req: IWorkLenzRequest, res: IWorkLenzResponse, next: () => void): void => {
    if (!req.user) {
      res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
      return;
    }
    if (!features.some((feature) => canUseFeature(req.user, feature))) {
      res.status(403).send(new ServerResponse(false, null, upgradeMessage(features[0])));
      return;
    }
    next();
  };

/**
 * Middleware for team-scoped requests authenticated by x-client-token (client portal), where
 * req.user is empty. Resolves the plan from req.organizationId (the client's team_id).
 */
export const requireFeatureForOrganization = (feature: FeatureKey) =>
  async (req: Request & { organizationId?: string }, res: Response, next: NextFunction): Promise<Response | void> => {
    // Preserve the self-hosted Business grant from requireBusinessPlanForOrganization.
    if (isSelfHostedDeployment()) return next();

    const teamId = req.organizationId;
    if (!teamId) return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));

    const subscriptionData = await checkTeamSubscriptionStatus(teamId);
    if (!subscriptionData || !canUseFeature(subscriptionData, feature)) {
      return res.status(403).send(new ServerResponse(false, null, upgradeMessage(feature)));
    }
    return next();
  };

/**
 * Does the account's plan lift the AppSumo (LTD) member cap? Invite and accept paths used to repeat
 * the "is this a Business plan" check inline (nine copies); they all ask this instead.
 *
 * - Paddle Billing plans are sold by seat, so the purchased quantity is the cap (enforced through
 *   getTeamMemberSeatLimit) and the LTD cap must not also apply.
 * - Enforcing: Business tier or above in the resolved entitlements.
 * - Otherwise: the legacy checks, unchanged.
 */
export function planLiftsLtdMemberLimit(subscriptionData: any): boolean {
  if (!subscriptionData) return false;
  if (subscriptionData.billing_provider === "paddle_billing") return true;
  if (isEnforceMode()) return tierAtLeast(resolveEntitlements(subscriptionData), "business");
  return (
    subscriptionData.subscription_type === "ANNUAL_BUSINESS" ||
    Boolean(subscriptionData.plan_name?.toLowerCase().includes("business")) ||
    subscriptionData.business_plan_override === true ||
    subscriptionData.appsumo_business_eligible === true
  );
}
