/** Matches on-page table value colors for analytics PDF exports. */

export const ANALYTICS_VALUE_COLORS = {
  danger: '#ff4d4f',
  success: '#52c41a',
  warning: '#faad14',
  secondary: '#8c8c8c',
} as const;

export function varianceDaysColor(days: number): string {
  if (days > 0) return ANALYTICS_VALUE_COLORS.danger;
  if (days < 0) return ANALYTICS_VALUE_COLORS.success;
  return ANALYTICS_VALUE_COLORS.secondary;
}

/** Overdue count: red when any overdue, muted zero. */
export function overdueCountColor(count: number): string {
  return count > 0
    ? ANALYTICS_VALUE_COLORS.danger
    : ANALYTICS_VALUE_COLORS.secondary;
}

export function utilizationPctColor(pct: number): string {
  if (pct > 100) return ANALYTICS_VALUE_COLORS.danger;
  if (pct > 80) return ANALYTICS_VALUE_COLORS.success;
  return ANALYTICS_VALUE_COLORS.warning;
}

export function utilizationStatusColor(status: string): string | null {
  if (status === 'over') return ANALYTICS_VALUE_COLORS.danger;
  if (status === 'optimal') return ANALYTICS_VALUE_COLORS.success;
  if (status === 'under') return ANALYTICS_VALUE_COLORS.warning;
  return null;
}

export function budgetBurnPctColor(pct: number): string {
  if (pct > 85) return ANALYTICS_VALUE_COLORS.danger;
  if (pct > 65) return ANALYTICS_VALUE_COLORS.warning;
  return ANALYTICS_VALUE_COLORS.success;
}

export function budgetRemainingColor(remaining: number): string {
  return remaining < 0
    ? ANALYTICS_VALUE_COLORS.danger
    : ANALYTICS_VALUE_COLORS.success;
}

export function budgetSpentColor(burnPct: number): string | null {
  return burnPct > 85 ? ANALYTICS_VALUE_COLORS.danger : null;
}

export function budgetAlertColor(alert: string): string | null {
  if (alert === 'high') return ANALYTICS_VALUE_COLORS.danger;
  if (alert === 'watch') return ANALYTICS_VALUE_COLORS.warning;
  if (alert === 'ok') return ANALYTICS_VALUE_COLORS.success;
  return null;
}
