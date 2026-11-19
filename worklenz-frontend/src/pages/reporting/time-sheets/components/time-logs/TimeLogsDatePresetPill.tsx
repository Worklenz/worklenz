/**
 * Re-export the shared reporting date preset pill under the Classic Time Logs name
 * so existing imports (Time Logs, Audit Log) keep working.
 */
export {
  ReportingDatePresetPill as TimeLogsDatePresetPill,
  PRESET_LABELS,
  type ReportingDatePresetPillProps as TimeLogsDatePresetPillProps,
} from '@/components/reporting/filters/ReportingDatePresetPill';
