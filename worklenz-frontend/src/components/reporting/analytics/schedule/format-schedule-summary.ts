import { ITaskRecurring } from '@/types/tasks/task-recurring-schedule';
import type { AnalyticsReportSchedule } from '@/types/reporting/analytics-schedules.types';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Short human-readable cadence for hub tables (English fallbacks; UI may wrap with i18n). */
export function formatScheduleCadence(schedule: AnalyticsReportSchedule): string {
  const time = (schedule.send_time || '08:00').slice(0, 5);

  switch (schedule.schedule_type) {
    case ITaskRecurring.Daily:
      return `Daily · ${time}`;
    case ITaskRecurring.Weekly: {
      const days = (schedule.days_of_week || [])
        .slice()
        .sort((a, b) => a - b)
        .map(d => DAY_LABELS[d] ?? String(d))
        .join(', ');
      return days ? `Weekly · ${days} · ${time}` : `Weekly · ${time}`;
    }
    case ITaskRecurring.Monthly:
      if (schedule.date_of_month != null) {
        return `Monthly · day ${schedule.date_of_month} · ${time}`;
      }
      return `Monthly · ${time}`;
    case ITaskRecurring.Yearly:
      return `Yearly · ${time}`;
    case ITaskRecurring.EveryXDays:
      return `Every ${schedule.interval_days || 1} days · ${time}`;
    case ITaskRecurring.EveryXWeeks:
      return `Every ${schedule.interval_weeks || 1} weeks · ${time}`;
    case ITaskRecurring.EveryXMonths:
      return `Every ${schedule.interval_months || 1} months · ${time}`;
    default:
      return `${schedule.schedule_type} · ${time}`;
  }
}

export function formatScheduleNextSend(nextSendAt: string | null, locale?: string): string {
  if (!nextSendAt) return '—';
  const date = new Date(nextSendAt);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(locale || undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
