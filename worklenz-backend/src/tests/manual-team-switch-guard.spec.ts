import {
  clearAutoTeamSwitchSuppressions,
  isAutoTeamSwitchSuppressed,
  suppressAutoTeamSwitch,
} from "../shared/manual-team-switch-guard";

describe("manual-team-switch-guard", () => {
  beforeEach(() => {
    clearAutoTeamSwitchSuppressions();
  });

  afterEach(() => {
    clearAutoTeamSwitchSuppressions();
  });

  it("suppresses auto team switch until cleared", () => {
    expect(isAutoTeamSwitchSuppressed("user-1")).toBe(false);

    suppressAutoTeamSwitch("user-1", 60_000);
    expect(isAutoTeamSwitchSuppressed("user-1")).toBe(true);
    expect(isAutoTeamSwitchSuppressed("user-2")).toBe(false);

    clearAutoTeamSwitchSuppressions();
    expect(isAutoTeamSwitchSuppressed("user-1")).toBe(false);
  });
});
