import moment from "moment-timezone";
import {
  computeFollowingSendAt,
  computeNextSendAt,
} from "../services/reporting-analytics/analytics-schedule-next-send";

describe("analytics-schedule-next-send", () => {
  it("picks today's send time when still upcoming for daily", () => {
    const from = moment.tz("2026-11-17 07:00", "Asia/Colombo").toDate();
    const next = computeNextSendAt(
      {
        schedule_type: "daily",
        send_time: "08:00",
        timezone: "Asia/Colombo",
      },
      from
    );
    expect(moment(next).tz("Asia/Colombo").format("YYYY-MM-DD HH:mm")).toBe(
      "2026-11-17 08:00"
    );
  });

  it("rolls to tomorrow when daily send time has passed", () => {
    const from = moment.tz("2026-11-17 09:00", "Asia/Colombo").toDate();
    const next = computeNextSendAt(
      {
        schedule_type: "daily",
        send_time: "08:00",
        timezone: "Asia/Colombo",
      },
      from
    );
    expect(moment(next).tz("Asia/Colombo").format("YYYY-MM-DD HH:mm")).toBe(
      "2026-11-18 08:00"
    );
  });

  it("finds the next matching weekday", () => {
    // Tuesday 2026-11-17
    const from = moment.tz("2026-11-17 10:00", "UTC").toDate();
    const next = computeNextSendAt(
      {
        schedule_type: "weekly",
        days_of_week: [1], // Monday
        send_time: "08:00",
        timezone: "UTC",
      },
      from
    );
    expect(moment.utc(next).format("YYYY-MM-DD HH:mm")).toBe("2026-11-23 08:00");
  });

  it("advances after a send for following occurrence", () => {
    const last = moment.tz("2026-11-17 08:00", "UTC").toDate();
    const next = computeFollowingSendAt(
      {
        schedule_type: "daily",
        send_time: "08:00",
        timezone: "UTC",
      },
      last
    );
    expect(moment.utc(next).format("YYYY-MM-DD HH:mm")).toBe("2026-11-18 08:00");
  });
});
