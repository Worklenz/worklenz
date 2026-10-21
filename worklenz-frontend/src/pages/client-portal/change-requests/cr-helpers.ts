import {
  CHANGE_REQUEST_BILLABLE_STATUSES,
  CHANGE_REQUEST_TERMINAL_STATUSES,
  type ChangeRequestEstimate,
  type ChangeRequestStatus,
} from '@/types/client-portal/v2';

/** Position of a status in the five-step progress bar; -1 for a cancelled request, which has no step. */
export const getChangeRequestStep = (status: ChangeRequestStatus): number => {
  switch (status) {
    case 'submitted':
      return 0;
    case 'under_review':
    case 'more_info':
      return 1;
    case 'approved':
    case 'rejected':
      return 2;
    case 'in_progress':
      return 3;
    case 'completed':
      return 4;
    default:
      return -1;
  }
};

export const isBillable = (status: ChangeRequestStatus): boolean =>
  CHANGE_REQUEST_BILLABLE_STATUSES.includes(status);

/** Completed, rejected and cancelled requests are read-only apart from linking billing documents. */
export const isTerminal = (status: ChangeRequestStatus): boolean =>
  CHANGE_REQUEST_TERMINAL_STATUSES.includes(status);

/**
 * "12 h · 1,500" for an estimate, or null when neither value is set. A blank stays blank: the client
 * never sees 0 unless staff entered zero on purpose. The cost has no currency of its own, so it is
 * shown as a number.
 */
export const formatEstimate = (
  estimate: ChangeRequestEstimate | null | undefined,
  hoursLabel: (hours: number) => string,
  locale?: string
): string | null => {
  if (!estimate) return null;
  const parts: string[] = [];
  if (estimate.hours !== null && estimate.hours !== undefined) parts.push(hoursLabel(estimate.hours));
  if (estimate.cost !== null && estimate.cost !== undefined) {
    parts.push(new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(estimate.cost));
  }
  return parts.length > 0 ? parts.join(' · ') : null;
};
