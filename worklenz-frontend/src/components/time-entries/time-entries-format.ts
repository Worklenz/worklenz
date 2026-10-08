import dayjs from 'dayjs';
import { formatSecondsToHoursMinutesText } from '@/utils/time-format.utils';

/**
 * The date a time entry was logged, for the "Logged On" column — "Sep 24" for
 * the current year, "Sep 24, 2025" otherwise so entries from earlier years
 * (custom date ranges) aren't ambiguous. In the By task table view this is
 * the task's most recent matching entry.
 */
export const formatLoggedOnDate = (isoDate: string): string => {
  const date = dayjs(isoDate);
  return date.format(date.isSame(dayjs(), 'year') ? 'MMM D' : 'MMM D, YYYY');
};

/** Full date and time, for the cell's hover title — the time of day is no
 * longer shown in the cell itself. */
export const formatLoggedOnTooltip = (isoDate: string): string =>
  dayjs(isoDate).format('MMM D, YYYY HH:mm');

/**
 * A logged duration as "2h 30m" — the format used for every duration on the
 * Time Entries page (Time Logged column, billable/non-billable rollups and the
 * summary cards). Always shows both parts ("0h 30m", "2h 0m"). Accepts the
 * numeric strings Postgres returns for NUMERIC sums, not just numbers.
 */
export const formatLoggedDuration = (seconds: number | string | null | undefined): string =>
  formatSecondsToHoursMinutesText(Number(seconds) || 0);
