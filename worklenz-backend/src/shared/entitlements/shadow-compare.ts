import { hasBusinessPlanAccess } from "../../ee/middlewares/subscription-middleware";
import { resolveLegacyGuestPlan } from "../guest-seat-limits";
import { hasFeature } from "./resolve-entitlements";
import { IEntitlements } from "./types";

/**
 * Shadow mode: while gates still run on the legacy checks, compare each legacy decision with the
 * entitlements-derived one and log disagreements. Disagreements are either bugs in the new
 * mapping or (more often) existing inconsistencies in the legacy checks; both need a decision
 * before Phase 2 switches the gates over. Set ENTITLEMENTS_SHADOW_MODE=off to disable.
 */

export interface IShadowMismatch {
  check: "business_features" | "guest_limit";
  legacy: boolean | number;
  entitlements: boolean | number;
}

const DEDUPE_TTL_MS = 6 * 60 * 60 * 1000;
const DEDUPE_MAX_ENTRIES = 5000;
const seen = new Map<string, number>();

export const shadowStats = { compared: 0, mismatched: 0, logged: 0 };

export function isShadowModeEnabled(): boolean {
  return (process.env.ENTITLEMENTS_SHADOW_MODE ?? "log").toLowerCase() !== "off";
}

export function resetShadowState(): void {
  seen.clear();
  shadowStats.compared = 0;
  shadowStats.mismatched = 0;
  shadowStats.logged = 0;
}

/** Pure comparison: returns the disagreements between legacy checks and entitlements. */
export function compareWithLegacy(user: any, entitlements: IEntitlements): IShadowMismatch[] {
  const mismatches: IShadowMismatch[] = [];

  const legacyBusiness = hasBusinessPlanAccess(user);
  const nextBusiness = hasFeature(entitlements, "finance_module");
  if (legacyBusiness !== nextBusiness) {
    mismatches.push({ check: "business_features", legacy: legacyBusiness, entitlements: nextBusiness });
  }

  const legacyGuests = resolveLegacyGuestPlan(user).guestLimit;
  if (legacyGuests !== entitlements.guestLimit) {
    mismatches.push({ check: "guest_limit", legacy: legacyGuests, entitlements: entitlements.guestLimit });
  }

  return mismatches;
}

/** Compare and log (deduplicated per user/check/values). Never throws: it must not affect auth. */
export function runShadowComparison(user: any, entitlements: IEntitlements, now: number = Date.now()): IShadowMismatch[] {
  if (!isShadowModeEnabled() || !user) return [];

  try {
    shadowStats.compared++;
    const mismatches = compareWithLegacy(user, entitlements);
    if (!mismatches.length) return mismatches;
    shadowStats.mismatched++;

    if (seen.size >= DEDUPE_MAX_ENTRIES) seen.clear();

    for (const mismatch of mismatches) {
      const key = `${user.id}|${mismatch.check}|${mismatch.legacy}|${mismatch.entitlements}`;
      const last = seen.get(key);
      if (last !== undefined && now - last < DEDUPE_TTL_MS) continue;
      seen.set(key, now);
      shadowStats.logged++;
      console.warn(
        "[entitlements-shadow]",
        JSON.stringify({
          ...mismatch,
          user_id: user.id,
          team_id: user.team_id,
          subscription_type: user.subscription_type,
          plan_name: user.plan_name,
          tier: entitlements.tier,
          source: entitlements.primarySource,
        }),
      );
    }
    return mismatches;
  } catch {
    return [];
  }
}
