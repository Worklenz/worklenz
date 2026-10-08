import {
  APPSUMO_LTD_GUEST_LIMIT,
  APPSUMO_MAX_SEATS,
  APPSUMO_SEATS_PER_CODE,
  APPSUMO_UNLIMITED_GUEST_CODE_COUNT,
  UNLIMITED,
} from "./feature-registry";
import { IPlanSource, PlanTier } from "./types";

/**
 * Subset of the session user (deserialize_user) / checkTeamSubscriptionStatus() row that the
 * existing licensing code branches on. Both shapes satisfy it.
 */
export interface ILegacyPlanSnapshot {
  subscription_type?: string | null;
  subscription_status?: string | null;
  plan_name?: string | null;
  business_plan_override?: unknown;
  active_plan_trial?: string | null;
  plan_trial_end_date?: string | Date | null;
  is_ltd?: boolean | null;
  redeemed_codes_count?: number | string | null;
  quantity?: number | string | null;
  team_member_limit_override?: unknown;
  /** Paddle Billing / provider marker once providers write plan sources (Phase 3). */
  billing_provider?: string | null;
}

const isTruthy = (value: unknown): boolean =>
  value === true || value === 1 || value === "true" || value === "t";

const toInt = (value: unknown): number => {
  const n = typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

/** Map a free-text plan name ("Business Plan", "Professional", "Pro", "enterprise") to a tier. */
export function tierFromPlanName(planName?: string | null): PlanTier | null {
  const name = (planName ?? "").toLowerCase();
  if (!name) return null;
  if (name.includes("enterprise")) return "enterprise";
  if (name.includes("business")) return "business";
  if (name.includes("pro")) return "pro"; // also matches "professional"
  return null;
}

/** Map licensing_plan_tiers.tier_name (trial rows) to a tier. */
export function tierFromTierName(tierName?: string | null): PlanTier {
  const name = (tierName ?? "").toUpperCase();
  if (name.startsWith("ENTERPRISE")) return "enterprise";
  if (name.startsWith("BUSINESS")) return "business";
  if (name.startsWith("PRO")) return "pro";
  return "free";
}

/**
 * Build plan sources from the legacy fields. This is the bridge: once providers write their own
 * sources (Paddle Billing, DirectPay, ...) this function only has to cover what is still read
 * from subscription_type.
 */
export function legacySnapshotToPlanSources(
  snapshot: ILegacyPlanSnapshot | null | undefined,
  now: Date = new Date(),
): IPlanSource[] {
  if (!snapshot) return [{ kind: "free", tier: "free" }];

  const sources: IPlanSource[] = [];
  const type = snapshot.subscription_type ?? "";

  if (isTruthy(snapshot.business_plan_override)) {
    sources.push({ kind: "override", tier: "business", seats: UNLIMITED, guests: UNLIMITED });
  }

  // Plan trial (Business / Enterprise / other tier). deserialize_user already filters to active
  // trials, but guard on the end date as the existing access checks do.
  const trialEnd = snapshot.plan_trial_end_date ? new Date(snapshot.plan_trial_end_date) : null;
  const trialTypeFlagged = type === "BUSINESS_TRIAL" || type === "ENTERPRISE_TRIAL" || type === "PLAN_TRIAL";
  const trialTierName =
    type === "BUSINESS_TRIAL" ? "BUSINESS_LARGE"
    : type === "ENTERPRISE_TRIAL" ? "ENTERPRISE"
    : snapshot.active_plan_trial ?? null;
  // A session type of *_TRIAL is authoritative; a bare active_plan_trial needs a future end date.
  const trialActive = trialTypeFlagged
    ? !trialEnd || trialEnd > now
    : !!snapshot.active_plan_trial && !!trialEnd && trialEnd > now;
  if (trialActive) {
    sources.push({ kind: "trial", tier: tierFromTierName(trialTierName), expiresAt: trialEnd });
  }

  const namedTier = tierFromPlanName(snapshot.plan_name);

  switch (type) {
    case "SELF_HOSTED":
      sources.push({ kind: "self_hosted", tier: "business", seats: UNLIMITED, guests: UNLIMITED });
      break;
    case "ANNUAL_BUSINESS":
      sources.push({ kind: "annual_license", tier: "business" });
      break;
    case "ANNUAL_PRO":
      sources.push({ kind: "annual_license", tier: "pro" });
      break;
    case "PADDLE":
      // Everything on Classic today is a pre-October-2026 plan, i.e. grandfathered once new
      // plans launch on Paddle Billing.
      sources.push({
        kind: snapshot.billing_provider === "paddle_billing" ? "paddle_billing" : "paddle_classic",
        tier: namedTier ?? "pro",
        grandfathered: snapshot.billing_provider !== "paddle_billing",
        seats: toInt(snapshot.quantity) || undefined,
      });
      break;
    case "CUSTOM":
      // Custom subscriptions include DirectPay (LKR) plans; unknown names count as Pro.
      sources.push({ kind: "custom", tier: namedTier ?? "pro" });
      break;
    case "CREDIT":
      sources.push({ kind: "credit", tier: namedTier ?? "pro" });
      break;
    default:
      break;
  }

  // AppSumo lifetime deal: independent of subscription_type, because an LTD holder may also be
  // on a trial or a paid subscription.
  const redeemedCodes = toInt(snapshot.redeemed_codes_count);
  if (type === "LIFE_TIME_DEAL" || (snapshot.is_ltd === true && redeemedCodes > 0)) {
    sources.push({
      kind: "appsumo_ltd",
      tier: "pro", // strict LTD: Pro-level features, no Business features via codes
      seats: redeemedCodes ? Math.min(redeemedCodes * APPSUMO_SEATS_PER_CODE, APPSUMO_MAX_SEATS) : undefined,
      guests: redeemedCodes >= APPSUMO_UNLIMITED_GUEST_CODE_COUNT ? UNLIMITED : APPSUMO_LTD_GUEST_LIMIT,
      redeemedCodes,
    });
  }

  if (!sources.length) sources.push({ kind: "free", tier: "free" });
  return sources;
}
