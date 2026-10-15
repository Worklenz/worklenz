import { useCallback, useState } from 'react';
import type { ColumnsType } from 'antd/es/table';

const readHidden = (storageKey: string, defaultHidden: string[]): string[] => {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw === null) return defaultHidden;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : defaultHidden;
  } catch {
    return defaultHidden;
  }
};

/** Which optional columns a list hides. Remembered per browser only; works when storage is blocked. */
export const useColumnVisibility = (storageKey: string, defaultHidden: string[] = []) => {
  const [hidden, setHidden] = useState<string[]>(() => readHidden(storageKey, defaultHidden));

  const toggle = useCallback(
    (key: string) =>
      setHidden(previous => {
        const next = previous.includes(key) ? previous.filter(item => item !== key) : [...previous, key];
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // Storage can be blocked; the choice then lasts until the page closes.
        }
        return next;
      }),
    [storageKey]
  );

  const visibleColumns = useCallback(
    <T extends object>(columns: ColumnsType<T>): ColumnsType<T> =>
      columns.filter(column => !(column.key !== undefined && hidden.includes(String(column.key)))),
    [hidden]
  );

  return { hidden, toggle, visibleColumns };
};
