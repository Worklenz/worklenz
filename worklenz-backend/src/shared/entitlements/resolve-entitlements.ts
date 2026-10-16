import {
  FEATURE_KEYS,
  FEATURE_REGISTRY,
  FREE_MEMBER_LIMIT,
  IFeatureDef,
  TIER_GUEST_LIMIT,
  UNLIMITED,
} from "./feature-registry";
import { ILegacyPlanSnapshot, legacySnapshotToPlanSources } from "./legacy-plan-sources";
import { IEntitlements, IPlanSource, PLAN_TIER_RANK, PlanTier } from "./types";

function sourceGrants(source: IPlanSource, def: IFeatureDef): boolean {
  if (def.denySources?.includes(source.kind)) return false;
  if (PLAN_TIER_RANK[source.tier] >= PLAN_TIER_RANK[def.minTier]) return true;
  if (def.allowSources?.includes(source.kind)) return true;
  return !!(def.grandfathered && source.grandfathered);
}

/** -1 (unlimited) beats any number; otherwise the larger number wins. */
function maxLimit(values: number[]): number {
  if (values.includes(UNLIMITED)) return UNLIMITED;
  return Math.max(...values);
}

function sumSeats(sources: IPlanSource[]): number | null {
  const seatSources = sources.filter((s) => s.seats !== undefined);
  if (!seatSources.length) return null;
  if (seatSources.some((s) => s.seats === UNLIMITED)) return UNLIMITED;
  return seatSources.reduce((total, s) => total + (s.seats as number), 0);
}

/**
 * Reduce the active plan sources to one Entitlements object.
 *
 * - tier:     highest tier among sources
 * - features: union of what each source grants
 * - guests:   most generous source (explicit source value, else the tier default)
 * - seats:    free tier = matrix cap; otherwise paid sources with an explicit seat count are
 *             summed (LTD seats + Expansion seats); unlimited wins; unspecified paid = unlimited
 */
export function resolveEntitlementsFromSources(sources: IPlanSource[]): IEntitlements {
  const active = sources.length ? sources : [{ kind: "free", tier: "free" } as IPlanSource];
  const ordered = [...active].sort((a, b) => PLAN_TIER_RANK[b.tier] - PLAN_TIER_RANK[a.tier]);
  const [primary] = ordered;

  const features = FEATURE_KEYS.filter((key) => {
    const def: IFeatureDef = FEATURE_REGISTRY[key];
    return ordered.some((source) => sourceGrants(source, def));
  });

  const guestLimit = maxLimit(ordered.map((s) => s.guests ?? TIER_GUEST_LIMIT[s.tier]));

  const paid = ordered.filter((s) => s.tier !== "free");
  let seatLimit: number | null;
  if (!paid.length) {
    seatLimit = FREE_MEMBER_LIMIT;
  } else if (paid.some((s) => s.seats === undefined && s.kind !== "appsumo_ltd")) {
    seatLimit = UNLIMITED; // per-user billed tiers have no cap
  } else {
    seatLimit = sumSeats(paid);
  }

  return {
    tier: primary.tier,
    features,
    guestLimit,
    seatLimit,
    sources: ordered.map(({ kind, tier, grandfathered, expiresAt }) => ({ kind, tier, grandfathered, expiresAt })),
    primarySource: primary.kind,
  };
}

/** Resolve entitlements from the legacy session / subscription-status fields. */
export function resolveEntitlements(
  snapshot: ILegacyPlanSnapshot | null | undefined,
  now: Date = new Date(),
): IEntitlements {
  return resolveEntitlementsFromSources(legacySnapshotToPlanSources(snapshot, now));
}

export function hasFeature(
  entitlements: Pick<IEntitlements, "features"> | null | undefined,
  feature: keyof typeof FEATURE_REGISTRY,
): boolean {
  return !!entitlements?.features.includes(feature);
}

export function tierAtLeast(entitlements: Pick<IEntitlements, "tier"> | null | undefined, tier: PlanTier): boolean {
  return !!entitlements && PLAN_TIER_RANK[entitlements.tier] >= PLAN_TIER_RANK[tier];
}
