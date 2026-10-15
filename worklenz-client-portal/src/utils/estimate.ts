import type { ClientChangeRequestV2 } from '@/types/v2';

/** "12 h · $1,200", or an empty string when the team has not given an estimate (never "0"). */
export const formatEstimate = (estimate: ClientChangeRequestV2['estimate']): string => {
  if (!estimate) return '';
  const parts: string[] = [];
  if (estimate.hours) parts.push(`${estimate.hours} h`);
  if (estimate.cost) parts.push(`$${estimate.cost.toLocaleString()}`);
  return parts.join(' · ');
};
