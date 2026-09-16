import { buildAllDayCalendarEvent } from "../services/google-calendar.service";

describe("Google Calendar integration helpers", () => {
  it("uses an exclusive end date for Worklenz all-day task events", () => {
    expect(buildAllDayCalendarEvent({
      name: "Client meeting",
      description: "Discuss launch",
      end_date: "2026-09-20T00:00:00.000Z",
    })).toEqual({
      summary: "Client meeting",
      description: "Discuss launch",
      start: { date: "2026-09-20" },
      end: { date: "2026-09-21" },
    });
  });

  it("uses the default description when a task has none", () => {
    expect(buildAllDayCalendarEvent({
      name: "Task",
      end_date: "2026-12-31T00:00:00.000Z",
    }).description).toBe("Worklenz task");
  });
});
