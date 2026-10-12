import dayjs, { Dayjs } from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat';

// Registered here, where its 'll' token is used, rather than relying on another module having done it.
dayjs.extend(localizedFormat);

/**
 * Named date ranges offered by the reporting date filters. The ranges are
 * derived from `now` every time they are asked for (never cached at module
 * load), so a tab left open past midnight never serves yesterday's "today".
 */
export type DatePresetKey =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_30_days'
  | 'last_month'
  | 'last_3_months'
  | 'last_90_days'
  | 'all_time';

export interface IDatePresetRange {
  /** Inclusive start, `YYYY-MM-DD` in the viewer's local calendar. */
  from: string;
  /** Inclusive end, `YYYY-MM-DD` in the viewer's local calendar. */
  to: string;
}

export const DATE_PRESET_FORMAT = 'YYYY-MM-DD';

const fmt = (date: Dayjs): string => date.format(DATE_PRESET_FORMAT);

/**
 * A calendar day written the way the viewer's language writes it ("Sep 17, 2026", "17. Sept. 2026",
 * "2026年9月17日"), using dayjs's global locale — which the app switches with the UI language.
 * Display only; ranges sent to the API stay ISO ({@link DATE_PRESET_FORMAT}).
 */
export const formatCalendarDate = (date: string | Dayjs): string => dayjs(date).format('ll');

/**
 * Resolves a preset to an inclusive local-calendar range, or `null` for
 * `all_time` (no bound at all).
 *
 * - `this_week` is week-to-date: the first day of the current week through *today*, today included
 *   (the week starts on the day dayjs's current locale says — the same rule `last_week` uses, so the
 *   two always sit side by side with no gap or overlap).
 * - `this_month` is month-to-date: the 1st through *today*, today included.
 * - `last_month` is the previous calendar month. It subtracts the month
 *   *before* taking `endOf('month')`: doing it the other way round
 *   (`endOf('month').subtract(1, 'month')`) keeps the current month's last
 *   day number, so on Sep 30 it yields Aug 30 and silently drops Aug 31.
 * - The rolling "last N days" presets end yesterday, as they always have.
 */
export const getDatePresetRange = (
  key: DatePresetKey,
  now: Dayjs = dayjs()
): IDatePresetRange | null => {
  const today = now.startOf('day');

  switch (key) {
    case 'today':
      return { from: fmt(today), to: fmt(today) };
    case 'yesterday': {
      const yesterday = today.subtract(1, 'day');
      return { from: fmt(yesterday), to: fmt(yesterday) };
    }
    case 'last_7_days':
      return { from: fmt(today.subtract(7, 'day')), to: fmt(today.subtract(1, 'day')) };
    case 'this_week':
      return { from: fmt(today.startOf('week')), to: fmt(today) };
    case 'last_week': {
      const previousWeek = today.subtract(1, 'week');
      return { from: fmt(previousWeek.startOf('week')), to: fmt(previousWeek.endOf('week')) };
    }
    case 'this_month':
      return { from: fmt(today.startOf('month')), to: fmt(today) };
    case 'last_30_days':
      return { from: fmt(today.subtract(30, 'day')), to: fmt(today.subtract(1, 'day')) };
    case 'last_month': {
      const previousMonth = today.subtract(1, 'month');
      return { from: fmt(previousMonth.startOf('month')), to: fmt(previousMonth.endOf('month')) };
    }
    case 'last_3_months':
      return { from: fmt(today.subtract(3, 'month')), to: fmt(today) };
    case 'last_90_days':
      return { from: fmt(today.subtract(90, 'day')), to: fmt(today.subtract(1, 'day')) };
    case 'all_time':
    default:
      return null;
  }
};
