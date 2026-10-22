import moment from "moment-timezone";
import { IRecurringSchedule } from "../interfaces/recurring-tasks";
import { resolveNextOccurrence } from "../cron_jobs/recurring-occurrence";

const FORMAT = "YYYY-MM-DD";
const now = moment.tz("2026-10-22T10:00:00", "UTC");

const schedule = (overrides: Partial<IRecurringSchedule>): IRecurringSchedule => ({
  id: "schedule-1",
  schedule_type: "daily",
  days_of_week: null,
  day_of_month: null,
  date_of_month: null,
  week_of_month: null,
  interval_days: null,
  interval_weeks: null,
  interval_months: null,
  last_created_task_end_date: null,
  last_checked_at: null,
  last_task_end_date: null,
  created_at: new Date("2026-05-01T00:00:00Z"),
  ...overrides
});

const last = (date: string) => moment.tz(date, "UTC");

describe("resolveNextOccurrence", () => {
  it("returns the next occurrence unchanged when nothing was missed", () => {
    const result = resolveNextOccurrence(schedule({}), last("2026-10-21"), now);
    expect(result.nextEndDate.format(FORMAT)).toBe("2026-10-22");
    expect(result.skippedCount).toBe(0);
  });

  it("returns the next occurrence when it is still in the future", () => {
    const result = resolveNextOccurrence(schedule({}), last("2026-10-22"), now);
    expect(result.nextEndDate.format(FORMAT)).toBe("2026-10-23");
    expect(result.skippedCount).toBe(0);
  });

  it("keeps the single late occurrence when only one was missed", () => {
    const result = resolveNextOccurrence(schedule({}), last("2026-10-20"), now);
    expect(result.nextEndDate.format(FORMAT)).toBe("2026-10-22");
    expect(result.skippedCount).toBe(1);
  });

  it("skips months of missed daily occurrences and resumes today", () => {
    const result = resolveNextOccurrence(schedule({}), last("2026-07-06"), now);
    expect(result.nextEndDate.format(FORMAT)).toBe("2026-10-22");
    expect(result.skippedCount).toBe(107);
  });

  it("resumes at the latest due weekly occurrence", () => {
    // Mondays: 2026-10-19 is the latest Monday on or before Thursday 2026-10-22
    const result = resolveNextOccurrence(schedule({ schedule_type: "weekly", days_of_week: [1] }), last("2026-08-03"), now);
    expect(result.nextEndDate.format(FORMAT)).toBe("2026-10-19");
    expect(result.nextEndDate.day()).toBe(1);
  });

  it("resumes at the latest due occurrence of an every_x_days schedule", () => {
    const result = resolveNextOccurrence(schedule({ schedule_type: "every_x_days", interval_days: 5 }), last("2026-09-01"), now);
    expect(result.nextEndDate.format(FORMAT)).toBe("2026-10-21");
  });

  it("resumes at the latest due monthly occurrence on a fixed date", () => {
    const result = resolveNextOccurrence(schedule({ schedule_type: "monthly", date_of_month: 15 }), last("2026-03-15"), now);
    expect(result.nextEndDate.format(FORMAT)).toBe("2026-10-15");
  });

  it("replays one missed occurrence at a time when skipping is disabled", () => {
    const result = resolveNextOccurrence(schedule({}), last("2026-07-06"), now, false);
    expect(result.nextEndDate.format(FORMAT)).toBe("2026-07-07");
    expect(result.skippedCount).toBe(0);
  });

  it("compares dates by day in the schedule timezone", () => {
    const evening = moment.tz("2026-10-22T23:30:00", "Asia/Colombo");
    const result = resolveNextOccurrence(schedule({}), moment.tz("2026-10-20", "Asia/Colombo"), evening);
    expect(result.nextEndDate.format(FORMAT)).toBe("2026-10-22");
  });
});
