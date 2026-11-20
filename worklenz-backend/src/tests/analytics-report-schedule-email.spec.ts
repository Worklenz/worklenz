import {
  buildEmailHtml,
  displayNameFromEmail,
} from "../cron_jobs/analytics-report-schedule-job";
import type { AnalyticsScheduleRow } from "../services/reporting-analytics/analytics-schedules.service";

function baseSchedule(
  overrides: Partial<AnalyticsScheduleRow> = {}
): AnalyticsScheduleRow {
  return {
    id: "sched-1",
    team_id: "team-1",
    owner_id: "owner-1",
    report_kind: "time-logs",
    report_name: "Weekly time report",
    template_id: null,
    schedule_type: "weekly",
    days_of_week: [1],
    day_of_month: null,
    date_of_month: null,
    week_of_month: null,
    interval_days: null,
    interval_weeks: null,
    interval_months: null,
    send_time: "09:00:00",
    timezone: "UTC",
    recipients: ["alex@example.com"],
    formats: ["PDF"],
    message: null,
    filters_json: {},
    paused: false,
    last_sent_at: null,
    next_send_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("analytics schedule email content", () => {
  it("derives a readable name from an email local-part", () => {
    expect(displayNameFromEmail("jane.doe@example.com")).toBe("Jane Doe");
    expect(displayNameFromEmail("")).toBe("there");
  });

  it("uses auto-generated body when message is empty", () => {
    const html = buildEmailHtml(baseSchedule({ message: "   " }), "Alex");
    expect(html).toContain("Hi Alex,");
    expect(html).toContain("This is your scheduled Worklenz report");
    expect(html).toContain("Weekly time report");
    expect(html).not.toContain("white-space:pre-wrap");
  });

  it("uses only greeting + custom message when message is set", () => {
    const html = buildEmailHtml(
      baseSchedule({ message: "Please review the attached numbers." }),
      "Sam"
    );
    expect(html).toContain("Hi Sam,");
    expect(html).toContain("Please review the attached numbers.");
    expect(html).not.toContain("This is your scheduled Worklenz report");
    expect(html).not.toContain("Weekly time report");
  });

  it("escapes HTML in custom messages and names", () => {
    const html = buildEmailHtml(
      baseSchedule({ message: '<script>alert("x")</script>' }),
      '<img src=x onerror=alert(1)>'
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src");
    expect(html).toContain("Hi &lt;img src=x onerror=alert(1)&gt;,");
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  });
});
