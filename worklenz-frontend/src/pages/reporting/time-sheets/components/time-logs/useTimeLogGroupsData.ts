import { reportingTimeLogsApiService } from '@/api/reporting/reporting-time-logs.api.service';
import { ITimeLogGroupsRequest } from '@/types/reporting/time-logs.types';
import { useLatestRequest } from './useLatestRequest';

/**
 * Loads one page of Member / Project / Client groups plus the whole-set totals. Pass `null` while
 * nothing is grouped (the table is on screen instead): nothing is requested then.
 */
export const useTimeLogGroupsData = (request: ITimeLogGroupsRequest | null) => {
  const { body, loading, failed, reload } = useLatestRequest(
    request,
    async nextRequest => {
      // Only called while enabled, i.e. with a request.
      if (!nextRequest) throw new Error('No group request to send');
      return reportingTimeLogsApiService.getTimeLogGroups(nextRequest);
    },
    { enabled: request !== null, errorLabel: 'Error fetching time log groups' }
  );

  // Groups of another dimension must not be labelled as this one while the new ones load.
  const current = body && request && body.group_by === request.group_by ? body : null;

  return {
    groups: current?.groups ?? [],
    totalGroups: current?.total_groups ?? 0,
    totalEntries: current?.total_entries ?? 0,
    totalSeconds: current?.total_seconds ?? 0,
    loading,
    failed,
    reload,
  };
};
