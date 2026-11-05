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
  defaultValue: T,
  isValid: (value: unknown) => value is T
): [T, Dispatch<SetStateAction<T>>] => {
  const readState = useCallback((): T => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw === null) return defaultValue;
      const value: unknown = JSON.parse(raw);
      return isValid(value) ? value : defaultValue;
    } catch {
      return defaultValue;
    }
  }, [storageKey, defaultValue, isValid]);

  const [stored, setStored] = useState(() => ({ key: storageKey, value: readState() }));
  const state = stored.key === storageKey ? stored.value : readState();

  useEffect(() => {
    if (stored.key !== storageKey) setStored({ key: storageKey, value: readState() });
  }, [storageKey, stored.key, readState]);

  useEffect(() => {
    if (stored.key !== storageKey) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(stored.value));
    } catch {
      // Storage may be unavailable or full.
    }
  }, [storageKey, stored]);

  const setPersistedState = useCallback<Dispatch<SetStateAction<T>>>(action => {
    setStored(prev => {
      const value = prev.key === storageKey ? prev.value : readState();
      return { key: storageKey, value: typeof action === 'function' ? (action as (p: T) => T)(value) : action };
    });
  }, [storageKey, readState]);

  return [state, setPersistedState];
};
