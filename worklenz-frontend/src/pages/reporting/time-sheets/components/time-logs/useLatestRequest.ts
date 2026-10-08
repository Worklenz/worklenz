import { useCallback, useEffect, useRef, useState } from 'react';
import { IServerResponse } from '@/types/common.types';
import logger from '@/utils/errorLogger';

interface ILatestRequestState<TBody> {
  body: TBody | null;
  /** The serialized request `body` was loaded for. */
  loadedKey: string | null;
  inFlight: boolean;
  failed: boolean;
}

const INITIAL_STATE: ILatestRequestState<never> = {
  body: null,
  loadedKey: null,
  inFlight: false,
  failed: false,
};

interface ILatestRequestOptions {
  /** A disabled request is never sent (and one already in flight is dropped). */
  enabled: boolean;
  /** What the logger says when a request throws. */
  errorLabel: string;
}

/**
 * Loads `request` through `fetcher` and reloads whenever its contents change. A response that
 * arrives after a newer request was issued (a faster later keystroke, a quick page change) is
 * dropped instead of overwriting the newer one.
 *
 * `loading` is derived rather than stored, so it is already true on the very render in which the
 * request changes (or becomes enabled) — never a frame of stale data or an empty state first.
 * A failed load leaves no body: there is never a stale figure next to an error.
 */
export const useLatestRequest = <TRequest, TBody>(
  request: TRequest,
  fetcher: (request: TRequest) => Promise<IServerResponse<TBody>>,
  { enabled, errorLabel }: ILatestRequestOptions
) => {
  const [state, setState] = useState<ILatestRequestState<TBody>>(INITIAL_STATE);
  const latestRequestRef = useRef(0);
  // `request` is rebuilt on every render; the serialized form is what decides whether it changed.
  const requestKey = JSON.stringify(request);
  const requestRef = useRef(request);
  requestRef.current = request;
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async () => {
    const requestId = ++latestRequestRef.current;
    setState(prev => ({ ...prev, inFlight: true, failed: false }));
    try {
      const res = await fetcherRef.current(requestRef.current);
      if (requestId !== latestRequestRef.current) return;
      const body = res.done && res.body ? res.body : null;
      setState({ body, loadedKey: requestKey, inFlight: false, failed: body === null });
    } catch (error) {
      if (requestId !== latestRequestRef.current) return;
      logger.error(errorLabel, error);
      setState({ body: null, loadedKey: requestKey, inFlight: false, failed: true });
    }
  }, [requestKey, errorLabel]);

  useEffect(() => {
    if (enabled) {
      void load();
    } else {
      // Whatever is still on its way is no longer wanted.
      latestRequestRef.current += 1;
    }
  }, [enabled, load]);

  const isCurrent = state.loadedKey === requestKey;
  return {
    body: state.body,
    loading: enabled && (state.inFlight || !isCurrent),
    failed: enabled && state.failed && isCurrent,
    reload: load,
  };
};
