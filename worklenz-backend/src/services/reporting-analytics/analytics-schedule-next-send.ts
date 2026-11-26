import moment from "moment-timezone";

export type AnalyticsScheduleType =
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "every_x_days"
  | "every_x_weeks"
  | "every_x_months";

export interface AnalyticsScheduleCadence {
  schedule_type: AnalyticsScheduleType;
  days_of_week?: number[] | null;
  day_of_month?: number | null;
  date_of_month?: number | null;
  week_of_month?: number | null;
  interval_days?: number | null;
  interval_weeks?: number | null;
  interval_months?: number | null;
  send_time: string;
  timezone: string;
}

function parseSendTime(sendTime: string): { hour: number; minute: number } {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(sendTime || "").trim());
  if (!match) return { hour: 8, minute: 0 };
  const hour = Math.min(23, Math.max(0, Number(match[1])));
  const minute = Math.min(59, Math.max(0, Number(match[2])));
  return { hour, minute };
}

function atSendTime(day: moment.Moment, hour: number, minute: number): moment.Moment {
  return day.clone().hour(hour).minute(minute).second(0).millisecond(0);
}

function resolveTimezone(tz: string): string {
  const name = (tz || "UTC").trim() || "UTC";
  return moment.tz.zone(name) ? name : "UTC";
}

function nthWeekdayOfMonth(
  base: moment.Moment,
  weekOfMonth: number,
  dayOfWeek: number
): moment.Moment {
  // week_of_month 1..4 = nth occurrence; 5 = last occurrence in month
  if (weekOfMonth >= 5) {
    const end = base.clone().endOf("month").startOf("day");
    const diff = (end.day() - dayOfWeek + 7) % 7;
    return end.clone().subtract(diff, "days");
  }
  const start = base.clone().startOf("month");
  const first = start.clone().day(dayOfWeek);
  if (first.month() !== start.month()) first.add(1, "week");
  return first.add(weekOfMonth - 1, "weeks");
}

function matchesWeekly(day: moment.Moment, daysOfWeek: number[]): boolean {
  return daysOfWeek.includes(day.day());
}

/**
 * Next send instant (UTC Date) for a report schedule after `from` (exclusive if equal to a slot).
 * Uses saved cadence + send_time in the schedule timezone.
 */
export function computeNextSendAt(
  cadence: AnalyticsScheduleCadence,
  from: Date | moment.Moment = new Date(),
  options?: { includeCurrentSlot?: boolean }
): Date {
  const tz = resolveTimezone(cadence.timezone);
  const { hour, minute } = parseSendTime(cadence.send_time);
  const now = moment(from).tz(tz);
  const includeCurrent = !!options?.includeCurrentSlot;

  const isAfterNow = (candidate: moment.Moment) =>
    includeCurrent ? !candidate.isBefore(now) : candidate.isAfter(now);

  switch (cadence.schedule_type) {
    case "daily": {
      let day = now.clone().startOf("day");
      for (let i = 0; i < 3; i++) {
        const slot = atSendTime(day, hour, minute);
        if (isAfterNow(slot)) return slot.utc().toDate();
        day.add(1, "day");
      }
      break;
    }
    case "weekly": {
      const days =
        Array.isArray(cadence.days_of_week) && cadence.days_of_week.length
          ? [...new Set(cadence.days_of_week.filter(d => d >= 0 && d <= 6))]
          : [1]; // Monday default
      let day = now.clone().startOf("day");
      for (let i = 0; i < 14; i++) {
        if (matchesWeekly(day, days)) {
          const slot = atSendTime(day, hour, minute);
          if (isAfterNow(slot)) return slot.utc().toDate();
        }
        day.add(1, "day");
      }
      break;
    }
    case "monthly": {
      let cursor = now.clone().startOf("month");
      for (let m = 0; m < 24; m++) {
        let day: moment.Moment;
        if (cadence.date_of_month) {
          const dim = cursor.daysInMonth();
          day = cursor.clone().date(Math.min(cadence.date_of_month, dim));
        } else if (cadence.week_of_month && cadence.day_of_month != null) {
          day = nthWeekdayOfMonth(cursor, cadence.week_of_month, cadence.day_of_month);
        } else {
          day = cursor.clone().date(1);
        }
        const slot = atSendTime(day, hour, minute);
        if (isAfterNow(slot)) return slot.utc().toDate();
        cursor.add(1, "month");
      }
      break;
    }
    case "yearly": {
      let year = now.clone().startOf("year");
      for (let y = 0; y < 5; y++) {
        // Keep month/day of "now" as anniversary unless date_of_month set
        const month = now.month();
        const date = cadence.date_of_month || now.date();
        const day = year.clone().month(month).date(Math.min(date, year.clone().month(month).daysInMonth()));
        const slot = atSendTime(day, hour, minute);
        if (isAfterNow(slot)) return slot.utc().toDate();
        year.add(1, "year");
      }
      break;
    }
    case "every_x_days": {
      const interval = Math.max(1, cadence.interval_days || 1);
      const todaySlot = atSendTime(now.clone().startOf("day"), hour, minute);
      if (isAfterNow(todaySlot)) return todaySlot.utc().toDate();
      return atSendTime(now.clone().startOf("day").add(interval, "days"), hour, minute)
        .utc()
        .toDate();
    }
    case "every_x_weeks": {
      const interval = Math.max(1, cadence.interval_weeks || 1);
      const todaySlot = atSendTime(now.clone().startOf("day"), hour, minute);
      if (isAfterNow(todaySlot)) return todaySlot.utc().toDate();
      return atSendTime(now.clone().startOf("day").add(interval, "weeks"), hour, minute)
        .utc()
        .toDate();
    }
    case "every_x_months": {
      const interval = Math.max(1, cadence.interval_months || 1);
      const todaySlot = atSendTime(now.clone().startOf("day"), hour, minute);
      if (isAfterNow(todaySlot)) return todaySlot.utc().toDate();
      return atSendTime(now.clone().startOf("day").add(interval, "months"), hour, minute)
        .utc()
        .toDate();
    }
    default:
      break;
  }

  // Fallback: tomorrow at send_time
  return atSendTime(now.clone().startOf("day").add(1, "day"), hour, minute).utc().toDate();
}

/** Advance from a just-sent slot to the following occurrence. */
export function computeFollowingSendAt(
  cadence: AnalyticsScheduleCadence,
  lastSentAt: Date | moment.Moment
): Date {
  return computeNextSendAt(cadence, lastSentAt, { includeCurrentSlot: false });
}
