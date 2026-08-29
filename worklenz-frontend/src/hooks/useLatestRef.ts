import { useRef } from 'react';
import useIsomorphicLayoutEffect from './useIsomorphicLayoutEffect';

/**
 * Keeps a ref pointed at the latest value without turning that value into a
 * dependency.
 *
 * Event handlers that read frequently-changing state (request params, view
 * mode, …) would otherwise have to list it as a `useCallback` dependency, so
 * the handler's identity changes on every update and every memoized child it is
 * passed to re-renders. Reading from a ref instead keeps the handler stable for
 * the lifetime of the component while still seeing fresh values when it runs.
 *
 * Only safe for values read inside callbacks/effects — never read `.current`
 * during render, since the ref intentionally lags behind by one commit.
 */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useIsomorphicLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}

export default useLatestRef;
