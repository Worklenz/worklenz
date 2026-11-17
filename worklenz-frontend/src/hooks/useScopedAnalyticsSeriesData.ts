import { useCallback, useState } from 'react';

interface ScopedSeriesData<T> {
  scope: string;
  requestKey: string;
  value: T;
}

/** Keep visible results in the active report and expose exact-filter results for seeding. */
export const useScopedAnalyticsSeriesData = <T,>(scope: string, requestKey: string) => {
  const [stored, setStored] = useState<ScopedSeriesData<T> | null>(null);
  const setData = useCallback((value: T | null) => {
    setStored(value === null ? null : { scope, requestKey, value });
  }, [scope, requestKey]);

  return {
    data: stored?.scope === scope ? stored.value : null,
    matchingData: stored?.scope === scope && stored.requestKey === requestKey ? stored.value : null,
    setData,
  };
};
