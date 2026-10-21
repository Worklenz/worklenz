const { getTeamMemberSeatLimit } = jest.requireActual("../shared/subscription-limits") as typeof import("../shared/subscription-limits");

describe("getTeamMemberSeatLimit", () => {
  it("returns the default limit when no subscription data is provided", () => {
    expect(getTeamMemberSeatLimit(undefined)).toBe(25);
    expect(getTeamMemberSeatLimit(null, 10)).toBe(10);
  });

  it("uses the highest of effective_user_limit and quantity", () => {
    expect(getTeamMemberSeatLimit({ effective_user_limit: 25, quantity: 26 })).toBe(26);
    expect(getTeamMemberSeatLimit({ effective_user_limit: "50", quantity: "1" })).toBe(50);
  });

  it("keeps LTD seat entitlement when present", () => {
    expect(getTeamMemberSeatLimit({ is_ltd: true, ltd_users: 50, effective_user_limit: 25, quantity: 26 })).toBe(50);
    expect(getTeamMemberSeatLimit({ is_ltd: true, ltd_users: "100" })).toBe(100);
  });

  it("ignores invalid or non-positive values", () => {
    expect(getTeamMemberSeatLimit({ effective_user_limit: "abc", quantity: -2, is_ltd: true, ltd_users: 0 })).toBe(25);
  });

  it("uses the purchased quantity, with no free floor, for per-user Paddle Billing plans", () => {
    expect(getTeamMemberSeatLimit({ billing_provider: "paddle_billing", quantity: 10, effective_user_limit: 25 })).toBe(10);
    expect(getTeamMemberSeatLimit({ billing_provider: "paddle_billing", quantity: 40 })).toBe(40);
  });

  it("keeps AppSumo seats for per-user plans, and falls back to the legacy limit without a quantity", () => {
    expect(getTeamMemberSeatLimit({ billing_provider: "paddle_billing", quantity: 10, is_ltd: true, ltd_users: 50 })).toBe(50);
    expect(getTeamMemberSeatLimit({ billing_provider: "paddle_billing", quantity: null })).toBe(25);
  });

  it("keeps the 25-seat floor for Classic subscriptions", () => {
    expect(getTeamMemberSeatLimit({ billing_provider: "paddle_classic", quantity: 10 })).toBe(25);
  });

  it("adds AppSumo Expansion seats on top of the lifetime-deal seats", () => {
    expect(
      getTeamMemberSeatLimit({
        billing_provider: "paddle_billing",
        plan_name: "Business AppSumo Expansion (per seat, monthly)",
        quantity: 10,
        is_ltd: true,
        ltd_users: 50,
      })
    ).toBe(60);
  });
});
