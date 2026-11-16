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

/** Preset key plus the manual custom-range choice used by reporting date filters. */
export type ReportingDatePreset = DatePresetKey | 'custom';

/** Inclusive `[from, to]` as `YYYY-MM-DD`. Only meaningful when preset is `custom`. */
export type ReportingCustomRange = [string, string] | null;

/**
 * Order the presets are offered in: shortest span first, grouped by period
 * (day, week, month), the current period before the previous one, then the
 * unbounded and manual choices.
 */
export const REPORTING_DATE_PRESETS: ReportingDatePreset[] = [
  'today',
  'yesterday',
  'this_week',
  'last_week',
  'last_7_days',
  'this_month',
  'last_month',
  'last_30_days',
  'last_3_months',
  'all_time',
  'custom',
];

/** Default text per preset, keyed to the `time-report` locale keys. */
export const REPORTING_DATE_PRESET_LABELS: Record<
  ReportingDatePreset,
  { key: string; defaultValue: string }
> = {
  today: { key: 'timeLogsPresetToday', defaultValue: 'Today' },
  yesterday: { key: 'timeLogsPresetYesterday', defaultValue: 'Yesterday' },
  last_7_days: { key: 'timeLogsPresetLast7Days', defaultValue: 'Last 7 Days' },
  this_week: { key: 'timeLogsPresetThisWeek', defaultValue: 'This Week' },
  last_week: { key: 'timeLogsPresetLastWeek', defaultValue: 'Last Week' },
  this_month: { key: 'timeLogsPresetThisMonth', defaultValue: 'This Month' },
  last_30_days: { key: 'timeLogsPresetLast30Days', defaultValue: 'Last 30 Days' },
  last_month: { key: 'timeLogsPresetLastMonth', defaultValue: 'Last Month' },
  last_3_months: { key: 'timeLogsPresetLast3Months', defaultValue: 'Last 3 Months' },
  last_90_days: { key: 'timeLogsPresetLast90Days', defaultValue: 'Last 90 Days' },
  all_time: { key: 'timeLogsPresetAllTime', defaultValue: 'All Time' },
  custom: { key: 'timeLogsPresetCustom', defaultValue: 'Custom Range' },
};

/**
 * The concrete calendar range a preset/custom choice stands for, or `null` for
 * "all time" (and for a custom range that has not been picked yet).
 */
export const resolveReportingDateRange = (
  state: { datePreset: ReportingDatePreset; customRange: ReportingCustomRange },
  now: Dayjs = dayjs()
): IDatePresetRange | null => {
  if (state.datePreset === 'custom') {
    return state.customRange ? { from: state.customRange[0], to: state.customRange[1] } : null;
  }
  return getDatePresetRange(state.datePreset, now);
};

/** "Sep 1, 2026 – Sep 17, 2026", a single date for one day, or `null` when unbounded. */
export const formatResolvedRange = (range: IDatePresetRange | null): string | null => {
  if (!range) return null;
  if (range.from === range.to) return formatCalendarDate(range.from);
  return `${formatCalendarDate(range.from)} – ${formatCalendarDate(range.to)}`;
};

export interface AnalyticsDateBounds {
  date_from?: string;
  date_to?: string;
}

/**
 * Resolves a reporting date filter into ISO day-bounds for Advanced analytics APIs.
 * Omits both fields for `all_time` or an incomplete custom range.
 */
export const resolveAnalyticsDateBounds = (
  datePreset: ReportingDatePreset,
  customRange: ReportingCustomRange,
  now: Dayjs = dayjs()
): AnalyticsDateBounds => {
  const range = resolveReportingDateRange({ datePreset, customRange }, now);
  if (!range) return {};
  return {
    date_from: dayjs(range.from).startOf('day').toISOString(),
    date_to: dayjs(range.to).endOf('day').toISOString(),
  };
};

/** True when a custom range has both ends (or the preset is not custom). */
export const isReportingDateApplicable = (
  datePreset: ReportingDatePreset,
  customRange: ReportingCustomRange
): boolean => datePreset !== 'custom' || customRange !== null;
