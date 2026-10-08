/**
 * Entitlements: the single answer to "what is this organization allowed to do?".
 *
 * Every payment/licence provider contributes a PlanSource. resolveEntitlements() reduces the
 * active sources to one Entitlements object. Feature gates must read that object (via
 * hasFeature) instead of inspecting subscription_type / plan_name strings.
 */

export type PlanTier = "free" | "pro" | "business" | "enterprise";

export const PLAN_TIER_RANK: Record<PlanTier, number> = {
  free: 0,
  pro: 1,
  business: 2,
  enterprise: 3,
};

export type PlanSourceKind =
  | "free"
  | "trial"
  | "paddle_classic"
  | "paddle_billing"
  | "directpay"
  | "custom"
  | "credit"
  | "annual_license"
  | "appsumo_ltd"
  | "appsumo_expansion"
  | "self_hosted"
  | "override";

export interface IPlanSource {
  kind: PlanSourceKind;
  tier: PlanTier;
  /** Existing (pre-October-2026) subscribers keep a few features newer plans no longer include. */
  grandfathered?: boolean;
  /** Seats this source grants. undefined = not specified, -1 = unlimited. */
  seats?: number;
  /** Guests this source grants. undefined = tier default, -1 = unlimited. */
  guests?: number;
  expiresAt?: Date | null;
  /** AppSumo only: redeemed LTD code count. */
  redeemedCodes?: number;
}

export interface IEntitlements {
  tier: PlanTier;
  features: string[];
  /** -1 = unlimited. */
  guestLimit: number;
  /** -1 = unlimited, null = not determinable from the data supplied. */
  seatLimit: number | null;
  /** Active sources, highest tier first. */
  sources: Array<Pick<IPlanSource, "kind" | "tier" | "grandfathered" | "expiresAt">>;
  primarySource: PlanSourceKind;
}
