import { allocateDailyTime, exceedsDailyTimeLimit } from "../shared/daily-time-limit";

describe("daily time accounting", () => {
  it("assigns a manual duration to its selected local day", () => {
    expect([...allocateDailyTime({ start: "2026-11-09T18:30:00Z", seconds: 100 * 3600, isTimedSession: false }, "Asia/Colombo")])
      .toEqual([["2026-11-10", 100 * 3600]]);
  });

  it("splits a timed session at every local midnight", () => {
    expect([...allocateDailyTime({ start: "2026-11-09T22:00:00Z", seconds: 28 * 3600, isTimedSession: true }, "UTC")])
      .toEqual([["2026-11-09", 7200], ["2026-11-10", 86400], ["2026-11-11", 7200]]);
  });

  it("uses timezone-aware midnights across daylight saving changes", () => {
    expect([...allocateDailyTime({ start: "2026-03-08T05:00:00Z", seconds: 24 * 3600, isTimedSession: true }, "America/New_York")])
      .toEqual([["2026-03-08", 23 * 3600], ["2026-03-09", 3600]]);
  });

  it("rejects enormous proposed timers without iterating through their days", () => {
    expect(() => allocateDailyTime({ start: "2026-01-01T00:00:00Z", seconds: 1e12, isTimedSession: true }, "UTC"))
      .toThrow("Timed session is too long");
  });

  it("calculates only relevant days for long existing timers", () => {
    expect([...allocateDailyTime(
      { start: "2020-01-01T00:00:00Z", seconds: 1e9, isTimedSession: true },
      "America/New_York",
      new Set(["2026-03-08"])
    )]).toEqual([["2026-03-08", 23 * 3600]]);
  });

  it("allows exactly 24 hours and reductions to existing excess", () => {
    const previous = new Map([["2026-11-10", 90000]]);
    expect(exceedsDailyTimeLimit(new Map(), new Map([["2026-11-10", 86400]]))).toBe(false);
    expect(exceedsDailyTimeLimit(previous, new Map([["2026-11-10", 89000]]))).toBe(false);
    expect(exceedsDailyTimeLimit(previous, new Map([["2026-11-10", 90001]]))).toBe(true);
    expect(exceedsDailyTimeLimit(previous, new Map([["2026-11-11", 86401]]))).toBe(true);
  });
});
