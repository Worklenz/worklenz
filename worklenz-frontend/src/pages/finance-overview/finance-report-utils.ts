import type { FinanceAlertStatus } from '@/api/finance-overview/finance-overview.api.service';

export const fmtMoney = (value: number, currency = 'USD'): string =>
  `${currency.toUpperCase()} ${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)}`;

export const fmtHours = (value: number): string =>
  `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value)}h`;

export const alertColor = (status: FinanceAlertStatus): string => {
  if (status === 'high') return '#ff4d4f';
  if (status === 'watch') return '#faad14';
  if (status === 'ok') return '#52c41a';
  return 'rgba(0,0,0,0.45)';
};

export const burnColor = (pct: number): string => {
  if (pct > 85) return '#ff4d4f';
  if (pct > 65) return '#faad14';
  return '#52c41a';
};

/**
 * Mirrors the fallback week/month boundary math in the backend's parseRange
 * (worklenz-backend/src/controllers/finance-reports-controller.ts). The
 * backend trusts the start/end this produces as-is (no re-normalization), so
 * keep the two in sync — a fix to one side (DST, week-start day, etc.)
 * applied only here will silently diverge from what the backend computes
 * for its own fallback (no-params) case.
 */
export const getRangeDates = (preset: 'week' | 'month' | 'lastMonth'): { start: string; end: string } => {
  const now = new Date();
  if (preset === 'week') {
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() + mondayOffset);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString() };
  }
  if (preset === 'lastMonth') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString() };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
};
