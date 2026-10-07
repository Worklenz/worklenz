import { useCallback, useEffect, useRef, useState } from 'react';

import { useAppSelector } from '@/hooks/useAppSelector';
import { IServerResponse } from '@/types/common.types';

interface SoftwareReportState<T> {
  data: T | null;
  isLoading: boolean;
  hasError: boolean;
  reload: () => void;
}

/**
 * Loads a software-project report and reloads it when `requestKey` changes,
 * when the project header refresh button is used, or when `reload` is called.
 * Pass a null key to skip loading.
 */
export const useSoftwareReport = <T>(
  requestKey: string | null,
  request: () => Promise<IServerResponse<T>>
): SoftwareReportState<T> => {
  const refreshTimestamp = useAppSelector(state => state.projectReducer.refreshTimestamp);
  const [reloadToken, setReloadToken] = useState(0);
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(!!requestKey);
  const [hasError, setHasError] = useState(false);
  const requestRef = useRef(request);
  requestRef.current = request;

  useEffect(() => {
    if (!requestKey) return;
    let isActive = true;
    setIsLoading(true);
    setHasError(false);

    requestRef
      .current()
      .then(response => {
        if (!isActive) return;
        if (response.done) {
          setData(response.body);
        } else {
          setHasError(true);
        }
      })
      .catch(() => {
        if (isActive) setHasError(true);
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [requestKey, refreshTimestamp, reloadToken]);

  const reload = useCallback(() => setReloadToken(token => token + 1), []);

  return { data, isLoading, hasError, reload };
};
