import { reportingTimeLogsApiService } from '@/api/reporting/reporting-time-logs.api.service';
import { ITimeLogsListRequest } from '@/types/reporting/time-logs.types';
import { useLatestRequest } from './useLatestRequest';

/**
 * Loads one page of time logs (entries, or tasks in the By task view) plus the whole-set totals.
 * Pass `enabled: false` while another view of the same data (the grouped list) is on screen.
 */
export const useTimeLogsData = (request: ITimeLogsListRequest, enabled = true) => {
  const { body, loading, failed, reload } = useLatestRequest(
    request,
    nextRequest => reportingTimeLogsApiService.getTimeLogs(nextRequest),
    { enabled, errorLabel: 'Error fetching time logs' }
  );

  // Rows of the other view must not be drawn under this view's columns while the new ones load.
  const current = body && body.view === (request.view ?? 'flat') ? body : null;

  return {
    logs: current?.logs ?? [],
    total: current?.total ?? 0,
    totalSeconds: current?.total_seconds ?? 0,
    loading,
    failed,
    reload,
  };
};
