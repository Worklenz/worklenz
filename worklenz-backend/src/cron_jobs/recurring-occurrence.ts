import moment from "moment-timezone";
import { calculateNextEndDate } from "../shared/utils";
import { IRecurringSchedule } from "../interfaces/recurring-tasks";

// Upper bound on occurrences walked in a single call (about 10 years of a daily schedule)
const MAX_OCCURRENCE_STEPS = 4000;

export interface INextOccurrence {
  nextEndDate: moment.Moment;
  // Number of missed occurrences passed over to reach nextEndDate
  skippedCount: number;
}

/**
 * Resolve the occurrence a schedule should create next.
 *
 * The job creates one occurrence per schedule per tick, so a schedule that fell behind
 * (paused, failing, or inactive for a while) would otherwise replay every missed date,
 * one per tick, and fill the project with backdated tasks. With `skipMissed` the result
 * is the most recent occurrence on or before `now` instead; missed ones are passed over.
 * When at most one occurrence is due, the result matches `calculateNextEndDate`.
 */
export function resolveNextOccurrence(
  schedule: IRecurringSchedule,
  lastEndDate: moment.Moment,
  now: moment.Moment,
  skipMissed = true
): INextOccurrence {
  let nextEndDate = calculateNextEndDate(schedule, lastEndDate);
  let skippedCount = 0;

  if (!skipMissed) {
    return { nextEndDate, skippedCount };
  }

  for (let step = 0; step < MAX_OCCURRENCE_STEPS; step++) {
    const following = calculateNextEndDate(schedule, nextEndDate);
    // Stop at the first occurrence after today, or if the schedule fails to advance
    if (following.isAfter(now, "day") || !following.isAfter(nextEndDate)) break;
    nextEndDate = following;
    skippedCount++;
  }

  return { nextEndDate, skippedCount };
}
