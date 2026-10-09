import dayjs from 'dayjs';
import type { TFunction } from 'i18next';
import type { GlobalToken } from 'antd';

import type { ReportStat } from './report-parts';

/** Formats a duration in days, switching to hours below one day. */
export const formatDuration = (t: TFunction, days: number | null | undefined): string => {
  if (days === null || days === undefined) return EMPTY_VALUE;
  if (days < 1) {
    return t('reportHoursValue', {
      defaultValue: '{{value}}h',
      value: Math.max(Math.round(days * 24), 0),
    });
  }
  return t('reportDaysValue', { defaultValue: '{{value}}d', value: roundToOneDecimal(days) });
};

export const formatPoints = (points: number): string => String(roundToOneDecimal(points));

export const formatShortDate = (date: string | null | undefined): string =>
  date ? dayjs(date).format('MMM D') : EMPTY_VALUE;

export const roundToOneDecimal = (value: number): number => Math.round(value * 10) / 10;

export const getPercentage = (part: number, total: number): number =>
  total > 0 ? Math.round((part / total) * 100) : 0;

/** Compares the current 30-day median cycle time with the 30 days before it. */
export const getCycleDeltaNote = (
  t: TFunction,
  current: number | null,
  previous: number | null
): Pick<ReportStat, 'note' | 'noteTone'> => {
  if (current === null) {
    return {
      note: t('reportsNoCompletedIssues', { defaultValue: 'No issues completed in 30 days' }),
    };
  }
  if (previous === null) {
    return { note: t('reportsLast30Days', { defaultValue: 'Last 30 days' }) };
  }

  const difference = current - previous;
  if (Math.abs(difference) < CYCLE_DELTA_TOLERANCE_DAYS) {
    return { note: t('reportsCycleUnchanged', { defaultValue: 'Same as previous 30 days' }) };
  }
  return difference < 0
    ? {
        note: t('reportsCycleFaster', {
          defaultValue: '{{value}} faster than previous 30 days',
          value: formatDuration(t, Math.abs(difference)),
        }),
        noteTone: 'success',
      }
    : {
        note: t('reportsCycleSlower', {
          defaultValue: '{{value}} slower than previous 30 days',
          value: formatDuration(t, difference),
        }),
        noteTone: 'warning',
      };
};

/** Chart colours that follow the active Ant Design theme. */
export const getChartTheme = (token: GlobalToken) => ({
  textColor: token.colorTextSecondary,
  gridColor: token.colorBorderSecondary,
  mutedColor: token.colorTextQuaternary,
  primaryColor: token.colorPrimary,
  warningColor: token.colorWarning,
  fontFamily: token.fontFamily,
});

export type ReportChartTheme = ReturnType<typeof getChartTheme>;

export const getBaseChartOptions = (chartTheme: ReportChartTheme) => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index' as const, intersect: false },
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: {
        color: chartTheme.textColor,
        boxWidth: 12,
        usePointStyle: true,
        font: { family: chartTheme.fontFamily, size: 12 },
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: chartTheme.textColor, font: { family: chartTheme.fontFamily, size: 11 } },
    },
    y: {
      beginAtZero: true,
      grid: { color: chartTheme.gridColor },
      ticks: {
        color: chartTheme.textColor,
        precision: 0,
        font: { family: chartTheme.fontFamily, size: 11 },
      },
    },
  },
});

export const EMPTY_VALUE = '–';

const CYCLE_DELTA_TOLERANCE_DAYS = 0.05;
