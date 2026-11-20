import moment from "moment-timezone";
import { IRecurringSchedule } from "../interfaces/recurring-tasks";
import { calculateNextEndDate } from "../shared/utils";

const FORMAT = "YYYY-MM-DD";

const monthlyOnWeekday = (dayOfWeek: number, weekOfMonth: number): IRecurringSchedule => ({
  id: "schedule-1",
  schedule_type: "monthly",
  days_of_week: null,
  day_of_month: dayOfWeek,
  date_of_month: null,
  week_of_month: weekOfMonth,
  interval_days: null,
  interval_weeks: null,
  interval_months: null,
  last_created_task_end_date: null,
  last_checked_at: null,
  last_task_end_date: null,
  created_at: new Date("2026-05-01T00:00:00Z")
});

const nextDates = (schedule: IRecurringSchedule, from: string, count: number) => {
  let date = moment.tz(from, "UTC");
  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    date = calculateNextEndDate(schedule, date);
    dates.push(date.format(FORMAT));
  }
  return dates;
};

describe("calculateNextEndDate - monthly on the Nth weekday", () => {
  it("moves the 1st Monday into the next month when the month starts after Monday", () => {
    // January 2027 starts on a Friday
    expect(nextDates(monthlyOnWeekday(1, 1), "2026-12-07", 4)).toEqual([
      "2027-01-04",
      "2027-02-01",
      "2027-03-01",
      "2027-04-05"
    ]);
  });

  it("keeps the 2nd Tuesday on the second Tuesday of every month", () => {
    expect(nextDates(monthlyOnWeekday(2, 2), "2026-12-08", 5)).toEqual([
      "2027-01-12",
      "2027-02-09",
      "2027-03-09",
      "2027-04-13",
      "2027-05-11"
    ]);
  });

  it("supports Sunday (day_of_month 0)", () => {
    expect(nextDates(monthlyOnWeekday(0, 1), "2026-12-06", 3)).toEqual([
      "2027-01-03",
      "2027-02-07",
      "2027-03-07"
    ]);
  });

  it("uses the last occurrence when week 5 does not exist", () => {
    expect(nextDates(monthlyOnWeekday(5, 5), "2026-12-25", 6)).toEqual([
      "2027-01-29",
      "2027-02-26",
      "2027-03-26",
      "2027-04-30",
      "2027-05-28",
      "2027-06-25"
    ]);
  });
});
