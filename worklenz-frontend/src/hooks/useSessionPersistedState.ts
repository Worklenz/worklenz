import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

/**
 * useState that mirrors its value into sessionStorage under `storageKey`.
 * Restores on mount so SPA navigations and tab refreshes keep the value.
 */
export const useSessionPersistedState = <T,>(
  storageKey: string,
  defaultValue: T
): [T, Dispatch<SetStateAction<T>>] => {
  const [state, setState] = useState<T>(() => {
    if (typeof sessionStorage === 'undefined') return defaultValue;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw == null) return defaultValue;
      return JSON.parse(raw) as T;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw == null) {
        setState(defaultValue);
        return;
      }
      setState(JSON.parse(raw) as T);
    } catch {
      setState(defaultValue);
    }
    // Re-hydrate when the key changes (e.g. workspace switch).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // ignore quota / private mode
    }
  }, [storageKey, state]);

  const setPersistedState = useCallback<Dispatch<SetStateAction<T>>>(action => {
    setState(prev => (typeof action === 'function' ? (action as (p: T) => T)(prev) : action));
  }, []);

  return [state, setPersistedState];
};
