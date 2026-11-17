import moment from "moment-timezone";

export const DAILY_TIME_LIMIT_SECONDS = 24 * 60 * 60;

export interface DailyTimeEntry {
  start: Date | string;
  seconds: number;
  /** Timed sessions are distributed over local calendar days. */
  isTimedSession: boolean;
}

/** Allocate a duration entry to its chosen date, or a timed session across local midnights. */
export function allocateDailyTime(entry: DailyTimeEntry, timezone: string): Map<string, number> {
  if (!moment.tz.zone(timezone) || !Number.isFinite(entry.seconds) || entry.seconds < 0) {
    throw new Error("Invalid timezone or duration");
  }
  const start = moment.tz(entry.start, timezone);
  if (!start.isValid()) throw new Error("Invalid start time");

  const totals = new Map<string, number>();
  if (!entry.isTimedSession) {
    totals.set(start.format("YYYY-MM-DD"), entry.seconds);
    return totals;
  }

  const end = start.clone().add(entry.seconds, "seconds");
  let cursor = start.clone();
  while (cursor.isBefore(end)) {
    const nextMidnight = cursor.clone().add(1, "day").startOf("day");
    const segmentEnd = moment.min(end, nextMidnight);
    const day = cursor.format("YYYY-MM-DD");
    totals.set(day, (totals.get(day) || 0) + segmentEnd.diff(cursor, "milliseconds") / 1000);
    cursor = segmentEnd.clone();
  }
  return totals;
}

/** Allow existing excess to be corrected, but never increased on any affected day. */
export function exceedsDailyTimeLimit(
  previousTotals: ReadonlyMap<string, number>,
  nextTotals: ReadonlyMap<string, number>
): boolean {
  for (const [day, next] of nextTotals) {
    if (next > DAILY_TIME_LIMIT_SECONDS && next > (previousTotals.get(day) || 0)) return true;
  }
  return false;
}
