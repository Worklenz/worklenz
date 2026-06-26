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
});
