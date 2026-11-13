import dayjs from 'dayjs';
import { ITaskLogViewModel } from '@/types/tasks/task-log-view.types';
import { formatSecondsToTimeString } from './time-format.utils';

/**
 * Formats a date as `MMM DD, YYYY` in local time.
 *
 * @param date - A Date or date string; `YYYY-MM-DD` strings are treated as local calendar dates.
 * @returns The formatted date using the active Day.js locale.
 */
export function formatDate(date: Date | string): string {
  // Handle ISO date strings (YYYY-MM-DD) as local dates to avoid timezone issues
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    return dayjs(localDate).format('MMM DD, YYYY');
  }
  return dayjs(date).format('MMM DD, YYYY');
}

/**
 * Builds a duration label, omitting the hours component when it is not positive.
 *
 * @param hours - Hours component; values greater than zero are included.
 * @param minutes - Minutes component, always included without normalization.
 * @param seconds - Seconds component, always included without normalization.
 * @returns A label such as `1h 5m 0s` or `0m 0s`.
 */
export function buildTimeString(hours: number, minutes: number, seconds: number) {
  const h = hours > 0 ? `${hours}h` : '';
  const m = `${minutes}m`;
  const s = `${seconds}s`;
  return `${h} ${m} ${s}`.trim();
}

export interface TimeRangeSplitResult {
  formatted_start: string;
  seconds_spent: number;
  date: dayjs.Dayjs;
  hours: number;
  minutes: number;
}

export interface OvernightSplitInfo {
  isOvernight: boolean;
  totalSeconds: number;
  totalMinutes: number;
  totalHours: number;
  remainingMinutes: number;
  splits: TimeRangeSplitResult[];
}

/**
 * Computes a time range's duration and splits it at the first local midnight.
 * Seconds and milliseconds are discarded. A later calendar date on the end
 * value is preserved; otherwise, an end time before the start rolls to the next day.
 * Ranges spanning multiple days still produce at most two segments, with the
 * second containing all time after the first midnight.
 *
 * @param dateValue - Calendar date on which the range starts.
 * @param startTimeValue - Start clock time, anchored to `dateValue`.
 * @param endTimeValue - End clock time, optionally carrying a later calendar date.
 * @returns Total duration and segments with ISO start timestamps. `isOvernight`
 * is true only when two nonempty segments exist; a same-day zero-duration range
 * returns one zero-duration segment.
 */
export function getTimeRangeBounds(
  dateValue: dayjs.Dayjs,
  startTimeValue: dayjs.Dayjs,
  endTimeValue: dayjs.Dayjs
): { fullStart: dayjs.Dayjs; fullEnd: dayjs.Dayjs } {
  const fullStart = dayjs(dateValue)
    .hour(startTimeValue.hour())
    .minute(startTimeValue.minute())
    .second(0)
    .millisecond(0);

  const calendarDayOffset = endTimeValue
    .startOf('day')
    .diff(startTimeValue.startOf('day'), 'day');
  let fullEnd = dayjs(dateValue)
    .add(calendarDayOffset, 'day')
    .hour(endTimeValue.hour())
    .minute(endTimeValue.minute())
    .second(0)
    .millisecond(0);

  if (fullEnd.isBefore(fullStart)) {
    fullEnd = fullEnd.add(1, 'day');
  }

  return { fullStart, fullEnd };
}

export function computeTimeRangeSplits(
  dateValue: dayjs.Dayjs,
  startTimeValue: dayjs.Dayjs,
  endTimeValue: dayjs.Dayjs
): OvernightSplitInfo {
  const { fullStart, fullEnd } = getTimeRangeBounds(dateValue, startTimeValue, endTimeValue);

  const isOvernight = !fullStart.isSame(fullEnd, 'day');
  const totalSeconds = Math.max(0, fullEnd.diff(fullStart, 'second'));
  const totalMinutes = Math.floor(totalSeconds / 60);

  if (!isOvernight) {
    const mins = totalMinutes;
    return {
      isOvernight: false,
      totalSeconds,
      totalMinutes,
      totalHours: Math.floor(mins / 60),
      remainingMinutes: mins % 60,
      splits: [
        {
          formatted_start: fullStart.toISOString(),
          seconds_spent: totalSeconds,
          date: fullStart.startOf('day'),
          hours: Math.floor(mins / 60),
          minutes: mins % 60,
        },
      ],
    };
  }

  const midnight = fullStart.clone().add(1, 'day').startOf('day');
  const day1Seconds = Math.max(0, midnight.diff(fullStart, 'second'));
  const day2Seconds = Math.max(0, fullEnd.diff(midnight, 'second'));

  const splits: TimeRangeSplitResult[] = [];
  if (day1Seconds > 0) {
    const day1Mins = Math.floor(day1Seconds / 60);
    splits.push({
      formatted_start: fullStart.toISOString(),
      seconds_spent: day1Seconds,
      date: fullStart.startOf('day'),
      hours: Math.floor(day1Mins / 60),
      minutes: day1Mins % 60,
    });
  }
  if (day2Seconds > 0) {
    const day2Mins = Math.floor(day2Seconds / 60);
    splits.push({
      formatted_start: midnight.toISOString(),
      seconds_spent: day2Seconds,
      date: midnight.startOf('day'),
      hours: Math.floor(day2Mins / 60),
      minutes: day2Mins % 60,
    });
  }

  return {
    isOvernight: splits.length > 1,
    totalSeconds,
    totalMinutes,
    totalHours: Math.floor(totalMinutes / 60),
    remainingMinutes: totalMinutes % 60,
    splits,
  };
}

/**
 * Merges split contiguous overnight time logs (e.g. Day 1 22:00-00:00 and Day 2 00:00-02:00)
 * into a single unified session entry for the task drawer time log view.
 */
export function groupContiguousOvernightLogs(logs: ITaskLogViewModel[]): ITaskLogViewModel[] {
  if (!logs || logs.length === 0) return [];

  const result: ITaskLogViewModel[] = [];
  const mergedIds = new Set<string>();

  for (let i = 0; i < logs.length; i++) {
    const current = logs[i];
    if (!current.id || mergedIds.has(current.id)) {
      continue;
    }

    if (current.logged_by_timer) {
      result.push(current);
      continue;
    }

    const startCurrent = dayjs(current.start_time || current.created_at);
    const endCurrent = current.end_time
      ? dayjs(current.end_time)
      : startCurrent.add(Number(current.time_spent || 0), 'second');

    const isMidnight = (d: dayjs.Dayjs, rawStr?: string) => {
      if (d.hour() === 0 && d.minute() === 0 && d.second() === 0) return true;
      if (rawStr && (String(rawStr).includes('T00:00:00') || String(rawStr).includes(' 00:00:00'))) return true;
      return false;
    };

    let partner: ITaskLogViewModel | null = null;
    let isCurrentDay1 = false;

    // Check if current could be Day 1 (ends at midnight into next day)
    const currentEndsAtMidnight =
      isMidnight(endCurrent, current.end_time) && !startCurrent.isSame(endCurrent, 'day');

    // Check if current could be Day 2 (starts at midnight)
    const currentStartsAtMidnight = isMidnight(startCurrent, current.start_time || current.created_at);

    for (let j = 0; j < logs.length; j++) {
      if (i === j) continue;
      const candidate = logs[j];
      if (!candidate.id || mergedIds.has(candidate.id)) continue;
      if (candidate.logged_by_timer) continue;
      if (String(candidate.user_id) !== String(current.user_id)) continue;
      if ((candidate.description || '').trim() !== (current.description || '').trim()) continue;

      const startCandidate = dayjs(candidate.start_time || candidate.created_at);
      const endCandidate = candidate.end_time
        ? dayjs(candidate.end_time)
        : startCandidate.add(Number(candidate.time_spent || 0), 'second');

      if (currentEndsAtMidnight) {
        // candidate should be Day 2 starting at endCurrent
        const isCandidateMidnightStart = isMidnight(startCandidate, candidate.start_time || candidate.created_at);
        const isContiguous = Math.abs(startCandidate.diff(endCurrent, 'second')) <= 1;
        if (isCandidateMidnightStart && isContiguous) {
          partner = candidate;
          isCurrentDay1 = true;
          break;
        }
      } else if (currentStartsAtMidnight) {
        // candidate should be Day 1 ending at startCurrent
        const isCandidateMidnightEnd =
          isMidnight(endCandidate, candidate.end_time) && !startCandidate.isSame(endCandidate, 'day');
        const isContiguous = Math.abs(endCandidate.diff(startCurrent, 'second')) <= 1;
        if (isCandidateMidnightEnd && isContiguous) {
          partner = candidate;
          isCurrentDay1 = false;
          break;
        }
      }
    }

    if (partner) {
      const day1 = isCurrentDay1 ? current : partner;
      const day2 = isCurrentDay1 ? partner : current;

      mergedIds.add(day1.id!);
      mergedIds.add(day2.id!);

      const startDay1 = dayjs(day1.start_time || day1.created_at);
      const endDay1 = day1.end_time
        ? dayjs(day1.end_time)
        : startDay1.add(Number(day1.time_spent || 0), 'second');

      const startDay2 = dayjs(day2.start_time || day2.created_at);
      const endDay2 = day2.end_time
        ? dayjs(day2.end_time)
        : startDay2.add(Number(day2.time_spent || 0), 'second');

      const totalSeconds = Number(day1.time_spent || 0) + Number(day2.time_spent || 0);

      const mergedLog: ITaskLogViewModel = {
        ...day1,
        id: day1.id,
        part_log_ids: [day1.id!, day2.id!],
        is_overnight_split: true,
        time_spent: totalSeconds,
        time_spent_text: formatSecondsToTimeString(totalSeconds),
        start_time: startDay1.toISOString(),
        end_time: endDay2.toISOString(),
        daily_breakdown: [
          {
            date: startDay1.format('YYYY-MM-DD'),
            date_formatted: startDay1.format('MMM DD'),
            time_spent: Number(day1.time_spent || 0),
            time_spent_text: formatSecondsToTimeString(Number(day1.time_spent || 0)),
            start_time: startDay1.toISOString(),
            end_time: endDay1.toISOString(),
            time_range_text: `${startDay1.format('HH:mm')} – 00:00`,
          },
          {
            date: startDay2.format('YYYY-MM-DD'),
            date_formatted: startDay2.format('MMM DD'),
            time_spent: Number(day2.time_spent || 0),
            time_spent_text: formatSecondsToTimeString(Number(day2.time_spent || 0)),
            start_time: startDay2.toISOString(),
            end_time: endDay2.toISOString(),
            time_range_text: `00:00 – ${endDay2.format('HH:mm')}`,
          },
        ],
      };

      result.push(mergedLog);
    } else {
      result.push(current);
    }
  }

  return result;
}
