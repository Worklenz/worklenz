import { NextFunction, Request, Response } from "express";
import { hasBusinessPlanAccess } from "../../ee/middlewares/subscription-middleware";
import { checkTeamSubscriptionStatus } from "../../ee/shared/paddle-utils";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { FEATURE_REGISTRY, FeatureKey } from "./feature-registry";
import { hasFeature, resolveEntitlements } from "./resolve-entitlements";

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

/**
 * Middleware for team-scoped requests authenticated by x-client-token (client portal), where
 * req.user is empty. Resolves the plan from req.organizationId (the client's team_id).
 */
export const requireFeatureForOrganization = (feature: FeatureKey) =>
  async (req: Request & { organizationId?: string }, res: Response, next: NextFunction): Promise<Response | void> => {
    const teamId = req.organizationId;
    if (!teamId) return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));

    const subscriptionData = await checkTeamSubscriptionStatus(teamId);
    if (!subscriptionData || !canUseFeature(subscriptionData, feature)) {
      return res.status(403).send(new ServerResponse(false, null, upgradeMessage(feature)));
    }
    return next();
  };
