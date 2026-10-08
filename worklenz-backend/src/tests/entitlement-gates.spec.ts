import {
  canUseFeature,
  requireFeature,
  requireFeatureForOrganization,
  teamCanUseFeature,
} from "../shared/entitlements/gates";
import * as paddleUtils from "../ee/shared/paddle-utils";

jest.mock("../ee/shared/paddle-utils");
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

  it("gives a plan named 'Pro' 5 guests (legacy gave 0)", async () => {
    status.mockResolvedValue(proClassic);
    guests.mockResolvedValue(0);
    expect((await getGuestSeatLimit("t1")).guest_limit).toBe(0);

    process.env.ENTITLEMENTS_ENFORCE = "on";
    const result = await getGuestSeatLimit("t1");
    expect(result.guest_limit).toBe(5);
    expect(result.plan_tier).toBe("PROFESSIONAL");
  });
});
