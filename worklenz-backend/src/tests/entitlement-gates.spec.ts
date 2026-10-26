// Legacy plan checks only apply to cloud deployments; self-hosted grants Business to everyone.
process.env.WORKLENZ_DEPLOYMENT_MODE = "cloud";

import {
  canUseFeature,
  requireFeature,
  requireFeatureForOrganization,
  planLiftsLtdMemberLimit,
  teamCanUseFeature,
} from "../shared/entitlements/gates";
import * as paddleUtils from "../shared/paddle-utils";

jest.mock("../shared/paddle-utils");
jest.mock("../shared/utils", () => ({ log_error: jest.fn() }));

const proClassic = { subscription_type: "PADDLE", plan_name: "Pro" };
const business = { subscription_type: "PADDLE", plan_name: "Business Plan" };
const customBusiness = { subscription_type: "CUSTOM", plan_name: "Business Plan" };
const free = { subscription_type: "FREE" };

const makeRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

afterEach(() => {
  delete process.env.ENTITLEMENTS_ENFORCE;
});

describe("canUseFeature: legacy mode (default)", () => {
  it("replicates the old Business-only check for Business features", () => {
    expect(canUseFeature(business, "finance_module")).toBe(true);
    expect(canUseFeature(proClassic, "finance_module")).toBe(false);
    expect(canUseFeature(free, "client_portal")).toBe(false);
    // known legacy quirk, preserved until enforcement is switched on
    expect(canUseFeature(customBusiness, "finance_module")).toBe(false);
  });

  it("does not gate non-Business features", () => {
    expect(canUseFeature(free, "kanban_board")).toBe(true);
  });

  it("denies when there is no subscription data", () => {
    expect(canUseFeature(null, "finance_module")).toBe(false);
  });
});

describe("canUseFeature: client portal (enforced even in legacy mode)", () => {
  it("allows Pro and Business, denies Free, and keeps branding Business-only", () => {
    for (const feature of ["client_portal", "client_portal_requests", "client_portal_invoices"] as const) {
      expect(canUseFeature(proClassic, feature)).toBe(true);
      expect(canUseFeature(business, feature)).toBe(true);
      expect(canUseFeature(free, feature)).toBe(false);
    }
    expect(canUseFeature(proClassic, "client_portal_branding")).toBe(false);
    expect(canUseFeature(business, "client_portal_branding")).toBe(true);
  });
});

describe("canUseFeature: client portal in self-hosted deployments", () => {
  afterEach(() => {
    process.env.WORKLENZ_DEPLOYMENT_MODE = "cloud";
  });

  it("grants the portal and branding even to a Free subscription row", () => {
    process.env.WORKLENZ_DEPLOYMENT_MODE = "self_hosted";
    for (const feature of [
      "client_portal", "client_portal_requests", "client_portal_chats", "client_portal_services",
      "client_portal_invoices", "client_portal_branding",
    ] as const) {
      expect(canUseFeature(free, feature)).toBe(true);
    }
  });
});

describe("canUseFeature: enforce mode", () => {
  beforeEach(() => {
    process.env.ENTITLEMENTS_ENFORCE = "on";
  });

  it("uses the registry", () => {
    expect(canUseFeature(business, "finance_module")).toBe(true);
    expect(canUseFeature(customBusiness, "finance_module")).toBe(true); // legacy quirk fixed
    expect(canUseFeature(proClassic, "finance_module")).toBe(false);
    expect(canUseFeature(free, "project_phases")).toBe(false);
    expect(canUseFeature(proClassic, "project_phases")).toBe(true);
  });

  it("Planner is Business only for Pro (classic or Billing)", () => {
    expect(canUseFeature(proClassic, "planner_schedule")).toBe(false);
    expect(canUseFeature({ ...proClassic, billing_provider: "paddle_billing" }, "planner_schedule")).toBe(false);
    expect(canUseFeature(business, "planner_schedule")).toBe(true);
  });
});

describe("requireFeature", () => {
  it("returns 401 without a user", () => {
    const res = makeRes();
    const next = jest.fn();
    requireFeature("finance_module")({} as any, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 with the legacy message when the plan lacks the feature", () => {
    const res = makeRes();
    const next = jest.fn();
    requireFeature("finance_module")({ user: free } as any, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.send.mock.calls[0][0].message).toBe("This feature requires a Business plan");
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next when allowed", () => {
    const res = makeRes();
    const next = jest.fn();
    requireFeature("finance_module")({ user: business } as any, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe("team-scoped checks", () => {
  const status = paddleUtils.checkTeamSubscriptionStatus as jest.Mock;

  it("teamCanUseFeature falls back to the legacy callback unless enforcing", async () => {
    status.mockResolvedValue(proClassic);
    const legacy = jest.fn().mockReturnValue(false);
    expect(await teamCanUseFeature("t1", "billable_marking", legacy)).toBe(false);

    process.env.ENTITLEMENTS_ENFORCE = "on";
    expect(await teamCanUseFeature("t1", "billable_marking", legacy)).toBe(true);
  });

  it("teamCanUseFeature is false without a team or subscription", async () => {
    expect(await teamCanUseFeature(undefined, "finance_module")).toBe(false);
    status.mockResolvedValue(undefined);
    expect(await teamCanUseFeature("t1", "finance_module")).toBe(false);
  });

  it("requireFeatureForOrganization resolves the plan from the team id", async () => {
    status.mockResolvedValue(business);
    const next = jest.fn();
    await requireFeatureForOrganization("client_portal")({ organizationId: "t1" } as any, makeRes(), next);
    expect(next).toHaveBeenCalled();

    status.mockResolvedValue(free);
    const res = makeRes();
    await requireFeatureForOrganization("client_portal")({ organizationId: "t1" } as any, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);

    const res401 = makeRes();
    await requireFeatureForOrganization("client_portal")({} as any, res401, jest.fn());
    expect(res401.status).toHaveBeenCalledWith(401);
  });
});

describe("guest limit under enforcement", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getGuestSeatLimit } = require("../shared/guest-seat-limits");
  const status = paddleUtils.checkTeamSubscriptionStatus as jest.Mock;
  const guests = paddleUtils.getActiveGuestCount as jest.Mock;

  it("gives a plan named 'Pro' unlimited guests, in legacy mode and when enforcing", async () => {
    status.mockResolvedValue(proClassic);
    guests.mockResolvedValue(0);
    expect((await getGuestSeatLimit("t1")).guest_limit).toBe(-1);

    process.env.ENTITLEMENTS_ENFORCE = "on";
    const result = await getGuestSeatLimit("t1");
    expect(result.guest_limit).toBe(-1);
    expect(result.plan_tier).toBe("PROFESSIONAL");
  });

  it.each([
    [1, "APPSUMO_LTD"],
    [4, "APPSUMO_LTD"],
    [5, "APPSUMO_BUSINESS"],
  ])("labels %s redeemed AppSumo codes as %s under enforcement", async (codes, expectedTier) => {
    process.env.ENTITLEMENTS_ENFORCE = "on";
    status.mockResolvedValue({ subscription_type: "LIFE_TIME_DEAL", is_ltd: true, redeemed_codes_count: codes });
    guests.mockResolvedValue(0);

    const result = await getGuestSeatLimit("t1");

    expect(result.plan_tier).toBe(expectedTier);
    expect(result.guest_limit).toBe(-1);
    expect(result.can_add_guest).toBe(true);
  });
});

describe("requireAnyFeature", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { requireAnyFeature } = require("../shared/entitlements/gates");
  const planner = ["planner_schedule", "planner_timeline", "planner_workload"];
  const ltd = { subscription_type: "LIFE_TIME_DEAL", is_ltd: true, redeemed_codes_count: 1 };

  it("legacy mode: Business only", () => {
    const next = jest.fn();
    requireAnyFeature(planner)({ user: business } as any, makeRes(), next);
    expect(next).toHaveBeenCalledTimes(1);

    const res = makeRes();
    const blocked = jest.fn();
    requireAnyFeature(planner)({ user: ltd } as any, res, blocked);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(blocked).not.toHaveBeenCalled();
  });

  it("enforce mode: AppSumo passes via Timeline/Workload, Pro and Free do not", () => {
    process.env.ENTITLEMENTS_ENFORCE = "on";
    const pass = jest.fn();
    requireAnyFeature(planner)({ user: ltd } as any, makeRes(), pass);
    expect(pass).toHaveBeenCalled();

    for (const user of [proClassic, free]) {
      const res = makeRes();
      const next = jest.fn();
      requireAnyFeature(planner)({ user } as any, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    }
  });

  it("401 without a user", () => {
    const res = makeRes();
    requireAnyFeature(planner)({} as any, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe("planLiftsLtdMemberLimit", () => {
  it("legacy: Business names, annual business, override and eligibility lift the cap", () => {
    expect(planLiftsLtdMemberLimit(business)).toBe(true);
    expect(planLiftsLtdMemberLimit({ subscription_type: "ANNUAL_BUSINESS" })).toBe(true);
    expect(planLiftsLtdMemberLimit({ business_plan_override: true })).toBe(true);
    expect(planLiftsLtdMemberLimit({ appsumo_business_eligible: true })).toBe(true);
    expect(planLiftsLtdMemberLimit(proClassic)).toBe(false);
    expect(planLiftsLtdMemberLimit(null)).toBe(false);
  });

  it("per-user Billing plans lift it: the purchased seats are the cap", () => {
    expect(
      planLiftsLtdMemberLimit({ billing_provider: "paddle_billing", plan_name: "Pro (per user, monthly)" })
    ).toBe(true);
  });

  it("enforcing: follows the resolved tier", () => {
    process.env.ENTITLEMENTS_ENFORCE = "on";
    expect(planLiftsLtdMemberLimit(business)).toBe(true);
    expect(planLiftsLtdMemberLimit(proClassic)).toBe(false);
  });
});


describe("requireFeatureForOrganization in self-hosted deployments", () => {
  it.each(["off", "on"])("keeps Business access without a cloud subscription when enforcement is %s", async enforce => {
    process.env.WORKLENZ_DEPLOYMENT_MODE = "self_hosted";
    process.env.ENTITLEMENTS_ENFORCE = enforce;
    jest.mocked(paddleUtils.checkTeamSubscriptionStatus).mockClear();
    const next = jest.fn();
    const middleware = requireFeatureForOrganization("client_portal");
    try {
      await middleware({ organizationId: "t1" } as Parameters<typeof middleware>[0], makeRes(), next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(paddleUtils.checkTeamSubscriptionStatus).not.toHaveBeenCalled();
    } finally {
      process.env.WORKLENZ_DEPLOYMENT_MODE = "cloud";
    }
  });
});
