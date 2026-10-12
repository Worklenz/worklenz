import { useCallback, useEffect, useRef, useState, DependencyList } from 'react';

interface FinanceReportResponse<T> {
  body?: T | null;
}

/**
 * Shared loading/error/fetch-on-mount-or-deps-change boilerplate for the
 * Finance report pages (Budgets, Forecasts, Invoices, Profitability,
 * Billable Time, Utilization). `fetchFn` is called on mount and whenever
 * `deps` changes (e.g. page/pageSize/range filters); `refetch` re-runs it
 * on demand (e.g. from a "Retry" button).
 *
 * Guards against out-of-order responses: if the user changes filters again
 * before an in-flight request resolves, only the response to the most
 * recently issued request is applied.
 */
export function useFinanceReportFetch<T>(
  fetchFn: () => Promise<FinanceReportResponse<T>>,
  deps: DependencyList = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const requestIdRef = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const refetch = useCallback(() => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(false);
    fetchFn()
      .then(res => {
        if (requestIdRef.current !== requestId) return;
        setData(res.body ?? null);
      })
      .catch(() => {
        if (requestIdRef.current !== requestId) return;
        setError(true);
      })
      .finally(() => {
        if (requestIdRef.current !== requestId) return;
        setLoading(false);
      });
  }, deps);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
