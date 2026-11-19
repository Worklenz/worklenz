import { useCallback, useEffect, useRef } from 'react';

/** Reject responses for older filters, report scopes, or retries. */
export const useLatestAnalyticsSeriesRequest = (requestKey: string) => {
  const request = useRef({ key: requestKey, version: 0 });
  if (request.current.key !== requestKey) {
    request.current = { key: requestKey, version: request.current.version + 1 };
  }

  useEffect(() => () => { request.current.version += 1; }, []);

  return useCallback(() => {
    const version = ++request.current.version;
    return () => request.current.version === version;
  }, []);
};
