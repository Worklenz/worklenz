/**
 * Phase 4 — Time in Status duration helper (OQ-9).
 */

jest.unmock("../services/reporting-analytics/time-in-status.service");

import { durationDays } from "../services/reporting-analytics/time-in-status.service";

describe("durationDays (OQ-9)", () => {
  it("counts full calendar span when weekends included", () => {
    // Fri 00:00 → Mon 00:00 = 3 calendar days
    const start = new Date("2026-10-23T00:00:00.000Z"); // Friday
    const end = new Date("2026-10-26T00:00:00.000Z"); // Monday
    expect(durationDays(start, end, false)).toBeCloseTo(3, 5);
  });

  it("excludes Saturday and Sunday portions", () => {
    const start = new Date("2026-10-23T00:00:00.000Z"); // Friday
    const end = new Date("2026-10-26T00:00:00.000Z"); // Monday
    // Fri + Mon-start = 1 day of weekday time (Sat+Sun dropped)
    expect(durationDays(start, end, true)).toBeCloseTo(1, 5);
  });

  it("returns 0 when end <= start", () => {
    const t = new Date("2026-10-23T12:00:00.000Z");
    expect(durationDays(t, t, false)).toBe(0);
  });
});
