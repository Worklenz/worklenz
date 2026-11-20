import moment from "moment-timezone";
import {
  applyLiveScheduleDateBounds,
  formatSchedulePdfFilterDetails,
  formatScheduleTimeRangeNote,
  resolveScheduleDateBounds,
} from "../services/reporting-analytics/analytics-schedule-date-bounds";

describe("analytics-schedule-date-bounds", () => {
  it("resolves yesterday relative to the schedule timezone calendar day", () => {
    const now = moment.tz("2026-11-18 08:00", "Asia/Colombo");
    const bounds = resolveScheduleDateBounds({
      datePreset: "yesterday",
      timezone: "Asia/Colombo",
      now,
    });

    expect(bounds).toEqual({
      date_from: "2026-11-17T00:00:00.000Z",
      date_to: "2026-11-17T23:59:59.999Z",
    });
  });

  it("rolls yesterday forward on the next calendar day", () => {
    const day1 = resolveScheduleDateBounds({
      datePreset: "yesterday",
      timezone: "UTC",
      now: moment.tz("2026-11-18 08:00", "UTC"),
    });
    const day2 = resolveScheduleDateBounds({
      datePreset: "yesterday",
      timezone: "UTC",
      now: moment.tz("2026-11-19 08:00", "UTC"),
    });

    expect(day1?.date_from).toBe("2026-11-17T00:00:00.000Z");
    expect(day2?.date_from).toBe("2026-11-18T00:00:00.000Z");
  });

  it("resolves last_30_days ending yesterday", () => {
    const bounds = resolveScheduleDateBounds({
      datePreset: "last_30_days",
      timezone: "UTC",
      now: moment.tz("2026-11-18 08:00", "UTC"),
    });

    expect(bounds).toEqual({
      date_from: "2026-10-19T00:00:00.000Z",
      date_to: "2026-11-17T23:59:59.999Z",
    });
  });

  it("clears absolute bounds for all_time", () => {
    const bounds = resolveScheduleDateBounds({
      datePreset: "all_time",
      timezone: "UTC",
      now: new Date("2026-11-18T08:00:00.000Z"),
    });
    expect(bounds).toEqual({});
  });

  it("keeps custom ranges from custom_range", () => {
    const bounds = resolveScheduleDateBounds({
      datePreset: "custom",
      customRange: ["2026-01-01", "2026-01-31"],
      timezone: "UTC",
      now: new Date("2026-11-18T08:00:00.000Z"),
    });

    expect(bounds).toEqual({
      date_from: "2026-01-01T00:00:00.000Z",
      date_to: "2026-01-31T23:59:59.999Z",
    });
  });

  it("leaves filters unchanged when date_preset is missing (backward compatible)", () => {
    const filters = {
      date_from: "2026-11-01T00:00:00.000Z",
      date_to: "2026-11-01T23:59:59.999Z",
      project_ids: ["abc"],
    };
    const next = applyLiveScheduleDateBounds(filters, "UTC", new Date());
    expect(next.date_from).toBe(filters.date_from);
    expect(next.date_to).toBe(filters.date_to);
    expect(next.project_ids).toEqual(["abc"]);
  });

  it("overwrites stale frozen dates when a relative preset is present", () => {
    const filters = {
      date_preset: "yesterday",
      date_from: "2026-11-01T00:00:00.000Z",
      date_to: "2026-11-01T23:59:59.999Z",
    };
    const next = applyLiveScheduleDateBounds(
      filters,
      "UTC",
      moment.tz("2026-11-18 08:00", "UTC")
    );

    expect(next.date_from).toBe("2026-11-17T00:00:00.000Z");
    expect(next.date_to).toBe("2026-11-17T23:59:59.999Z");
    expect(next.date_preset).toBe("yesterday");
  });

  it("formats an email time-range note for yesterday", () => {
    const note = formatScheduleTimeRangeNote(
      { date_preset: "yesterday" },
      "UTC",
      moment.tz("2026-11-18 08:00", "UTC")
    );
    expect(note).toBe("Yesterday (17 Nov 2026)");
  });

  it("formats an email time-range note for last_30_days", () => {
    const note = formatScheduleTimeRangeNote(
      { date_preset: "last_30_days" },
      "UTC",
      moment.tz("2026-11-18 08:00", "UTC")
    );
    expect(note).toBe("Last 30 days (19 Oct 2026 – 17 Nov 2026)");
  });

  it("formats all_time without calendar bounds", () => {
    expect(
      formatScheduleTimeRangeNote({ date_preset: "all_time" }, "UTC", new Date())
    ).toBe("All time");
  });

  it("formats PDF filter details with time range and scope counts", () => {
    const details = formatSchedulePdfFilterDetails(
      {
        date_preset: "last_3_months",
        project_ids: [],
        project_scope: "live",
        team_ids: ["t1"],
        member_ids: [],
      },
      "UTC",
      moment.tz("2026-11-18 08:00", "UTC")
    );
    expect(details).toContain("Time range: Last 3 months");
    expect(details).toContain("Projects: All");
    expect(details).toContain("Teams: 1 selected");
  });
});
