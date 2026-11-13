import type { ProjectHealthTone } from '@/types/reporting/analytics-project-health.types';

/**
 * Canonical health tone colors for KPI tiles, donut, and table fallbacks.
 * Do not use per-project DB `health_color` for report chrome — org seed data
 * can disagree with these semantics and desync cards vs chart.
 */
export const PROJECT_HEALTH_TONE_COLORS: Record<ProjectHealthTone, string> = {
  on_track: '#52c41a',
  at_risk: '#faad14',
  off_track: '#ff4d4f',
  not_set: '#8c8c8c',
};
