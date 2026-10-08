import {
  FEATURE_KEYS,
  FEATURE_REGISTRY,
  PLAN_TIER_RANK,
  compareWithLegacy,
  hasFeature,
  legacySnapshotToPlanSources,
  resetShadowState,
  resolveEntitlements,
  resolveEntitlementsFromSources,
  runShadowComparison,
  shadowStats,
  tierFromPlanName,
} from "../shared/entitlements";

jest.mock("../ee/shared/paddle-utils");
jest.mock("../shared/utils", () => ({
  log_error: jest.fn(),
}));

const NOW = new Date("2026-10-15T00:00:00Z");
const FUTURE = "2026-10-29T00:00:00Z";
const PAST = "2026-10-01T00:00:00Z";

const paddle = (plan_name: string, extra: Record<string, unknown> = {}) => ({
  subscription_type: "PADDLE",
  plan_name,
  ...extra,
});

describe("feature registry", () => {
  it("has a valid minimum tier for every feature", () => {
    for (const key of FEATURE_KEYS) {
      expect(PLAN_TIER_RANK[FEATURE_REGISTRY[key].minTier as keyof typeof PLAN_TIER_RANK]).toBeDefined();
    }
  });

  it("gates the Business-only matrix rows at business", () => {
    for (const key of [
      "finance_module", "billable_reporting", "client_portal", "client_portal_invoices", "slack_integration",
      "advanced_reporting", "priority_support", "gantt_edit", "planner_schedule", "planner_timeline", "planner_workload",
    ] as const) {
      expect(FEATURE_REGISTRY[key].minTier).toBe("business");
    }
  });
});

describe("resolveEntitlements", () => {
  it("free: matrix free features, no guests, 5 seats", () => {
    const e = resolveEntitlements({ subscription_type: "FREE" }, NOW);
    expect(e.tier).toBe("free");
    expect(hasFeature(e, "kanban_board")).toBe(true);
    expect(hasFeature(e, "project_phases")).toBe(false);
    expect(hasFeature(e, "client_portal")).toBe(false);
    expect(e.guestLimit).toBe(0);
    expect(e.seatLimit).toBe(5);
  });

  it("treats a missing session as free", () => {
    expect(resolveEntitlements(null, NOW).tier).toBe("free");
  });

  it("classic Pro: pro features, 5 guests, no Planner, no Business features", () => {
    const e = resolveEntitlements(paddle("Pro", { quantity: 8 }), NOW);
    expect(e.tier).toBe("pro");
    expect(e.primarySource).toBe("paddle_classic");
    expect(hasFeature(e, "project_health")).toBe(true);
    expect(hasFeature(e, "reports_export")).toBe(true);
    expect(hasFeature(e, "planner_schedule")).toBe(false);
    expect(hasFeature(e, "finance_module")).toBe(false);
    expect(e.guestLimit).toBe(5);
    expect(e.seatLimit).toBe(8);
  });

  it("new Paddle Billing Pro: no Planner", () => {
    const e = resolveEntitlements(paddle("Pro", { billing_provider: "paddle_billing" }), NOW);
    expect(e.primarySource).toBe("paddle_billing");
    expect(hasFeature(e, "project_health")).toBe(true);
    expect(hasFeature(e, "planner_schedule")).toBe(false);
    expect(hasFeature(e, "planner_workload")).toBe(false);
    expect(e.seatLimit).toBe(-1);
  });

  it("business: everything Business, unlimited guests", () => {
    const e = resolveEntitlements(paddle("Business Plan"), NOW);
    expect(e.tier).toBe("business");
    for (const key of ["finance_module", "client_portal", "planner_schedule", "slack_integration", "advanced_reporting"] as const) {
      expect(hasFeature(e, key)).toBe(true);
    }
    expect(e.guestLimit).toBe(-1);
  });

  it("business trial grants Business until it expires", () => {
    const active = resolveEntitlements(
      { subscription_type: "BUSINESS_TRIAL", active_plan_trial: "BUSINESS_LARGE", plan_trial_end_date: FUTURE },
      NOW,
    );
    expect(active.tier).toBe("business");
    expect(active.primarySource).toBe("trial");

    const expired = resolveEntitlements(
      { subscription_type: "FREE", active_plan_trial: "BUSINESS_LARGE", plan_trial_end_date: PAST },
      NOW,
    );
    expect(expired.tier).toBe("free");
  });

  it("AppSumo LTD (1 code): Pro features, 5 seats, 5 guests, Timeline and Workload only, no Business features", () => {
    const e = resolveEntitlements({ subscription_type: "LIFE_TIME_DEAL", is_ltd: true, redeemed_codes_count: 1 }, NOW);
    expect(e.tier).toBe("pro");
    expect(e.primarySource).toBe("appsumo_ltd");
    expect(hasFeature(e, "planner_workload")).toBe(true);
    expect(hasFeature(e, "planner_timeline")).toBe(true);
    expect(hasFeature(e, "planner_schedule")).toBe(false); // matrix: AppSumo No
    expect(hasFeature(e, "finance_module")).toBe(false);
    expect(hasFeature(e, "members_progress")).toBe(false); // matrix: AppSumo No
    expect(e.seatLimit).toBe(5);
    expect(e.guestLimit).toBe(5);
  });

  it("AppSumo LTD: 5 seats per code capped at 50; 5+ codes unlimited guests", () => {
    const five = resolveEntitlements({ subscription_type: "LIFE_TIME_DEAL", is_ltd: true, redeemed_codes_count: 5 }, NOW);
    expect(five.seatLimit).toBe(25);
    expect(five.guestLimit).toBe(-1);

    const many = resolveEntitlements({ subscription_type: "LIFE_TIME_DEAL", is_ltd: true, redeemed_codes_count: 14 }, NOW);
    expect(many.seatLimit).toBe(50);
  });

  it("LTD holder on a Business trial gets Business now, LTD seats and guests combine", () => {
    const e = resolveEntitlements(
      {
        subscription_type: "BUSINESS_TRIAL", active_plan_trial: "BUSINESS_LARGE", plan_trial_end_date: FUTURE,
        is_ltd: true, redeemed_codes_count: 2,
      },
      NOW,
    );
    expect(e.tier).toBe("business");
    expect(hasFeature(e, "finance_module")).toBe(true);
    expect(e.sources.map((s) => s.kind).sort()).toEqual(["appsumo_ltd", "trial"]);
  });

  it("AppSumo Expansion: LTD seats plus paid seats, Business features", () => {
    const e = resolveEntitlementsFromSources([
      { kind: "appsumo_ltd", tier: "pro", seats: 10, guests: 5, redeemedCodes: 2 },
      { kind: "appsumo_expansion", tier: "business", seats: 7 },
    ]);
    expect(e.tier).toBe("business");
    expect(e.seatLimit).toBe(17);
    expect(e.guestLimit).toBe(-1);
    expect(hasFeature(e, "client_portal")).toBe(true);
  });

  it("self hosted and manual override are Business with unlimited seats and guests", () => {
    for (const snapshot of [{ subscription_type: "SELF_HOSTED" }, { subscription_type: "FREE", business_plan_override: true }]) {
      const e = resolveEntitlements(snapshot, NOW);
      expect(e.tier).toBe("business");
      expect(e.seatLimit).toBe(-1);
      expect(e.guestLimit).toBe(-1);
    }
  });

  it("custom (DirectPay) plans resolve by plan name, unknown names count as Pro", () => {
    expect(resolveEntitlements({ subscription_type: "CUSTOM", plan_name: "Business Plan" }, NOW).tier).toBe("business");
    expect(resolveEntitlements({ subscription_type: "CUSTOM", plan_name: "Pro Plan" }, NOW).tier).toBe("pro");
    expect(resolveEntitlements({ subscription_type: "CUSTOM", plan_name: "Something" }, NOW).tier).toBe("pro");
  });

  it("enterprise trial resolves to enterprise", () => {
    const e = resolveEntitlements(
      { subscription_type: "ENTERPRISE_TRIAL", active_plan_trial: "ENTERPRISE", plan_trial_end_date: FUTURE },
      NOW,
    );
    expect(e.tier).toBe("enterprise");
    expect(hasFeature(e, "finance_module")).toBe(true);
  });
});

describe("plan name mapping", () => {
  it.each([
    ["Business Plan", "business"],
    ["Enterprise", "enterprise"],
    ["Professional", "pro"],
    ["Pro", "pro"],
    ["", null],
    [undefined, null],
  ])("%p -> %p", (name, tier) => {
    expect(tierFromPlanName(name as string | undefined)).toBe(tier);
  });
});

describe("legacySnapshotToPlanSources", () => {
  it("returns a free source when nothing applies", () => {
    expect(legacySnapshotToPlanSources({}, NOW)).toEqual([{ kind: "free", tier: "free" }]);
  });
});

describe("shadow comparison", () => {
  beforeEach(() => {
    resetShadowState();
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.ENTITLEMENTS_SHADOW_MODE;
  });

  const compare = (user: any) => compareWithLegacy(user, resolveEntitlements(user, NOW));

  it("agrees with the legacy checks for the mainstream plans", () => {
    const agreeing = [
      { subscription_type: "FREE" },
      paddle("Business Plan"),
      paddle("Professional"),
      { subscription_type: "SELF_HOSTED" },
      { subscription_type: "ANNUAL_BUSINESS" },
      { subscription_type: "LIFE_TIME_DEAL", is_ltd: true, redeemed_codes_count: 1 },
      { subscription_type: "FREE", business_plan_override: true },
      { subscription_type: "BUSINESS_TRIAL", active_plan_trial: "BUSINESS_LARGE", plan_trial_end_date: FUTURE, plan_name: "business" },
    ];
    for (const user of agreeing) expect(compare(user)).toEqual([]);
  });

  it("flags known legacy inconsistencies", () => {
    // Plan named "Pro" (not "Professional") gets 0 guests from the legacy check; matrix says 5.
    expect(compare(paddle("Pro"))).toEqual([{ check: "guest_limit", legacy: 0, entitlements: 5 }]);
    // Custom/DirectPay Business never passes the legacy business check.
    expect(compare({ subscription_type: "CUSTOM", plan_name: "Business Plan" })).toEqual([
      { check: "business_features", legacy: false, entitlements: true },
    ]);
  });

  it("logs a mismatch once per user/check, and counts compared sessions", () => {
    const user = { id: "u1", team_id: "t1", ...paddle("Pro") };
    const e = resolveEntitlements(user, NOW);
    runShadowComparison(user, e, 1000);
    runShadowComparison(user, e, 2000);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(shadowStats).toEqual({ compared: 2, mismatched: 2, logged: 1 });

    // Logs again after the dedupe window.
    runShadowComparison(user, e, 1000 + 7 * 60 * 60 * 1000);
    expect(console.warn).toHaveBeenCalledTimes(2);
  });

  it("does nothing when disabled", () => {
    process.env.ENTITLEMENTS_SHADOW_MODE = "off";
    const user = { id: "u1", ...paddle("Pro") };
    runShadowComparison(user, resolveEntitlements(user, NOW));
    expect(console.warn).not.toHaveBeenCalled();
    expect(shadowStats.compared).toBe(0);
  });
});
