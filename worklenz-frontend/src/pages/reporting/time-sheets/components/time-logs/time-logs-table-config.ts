import { useLayoutEffect, useRef, useState } from 'react';

// The Time Logs tables share the Projects report table's density: 56px rows, 12px / 10px padding.
export const ROW_HEIGHT = 56;

export const TABLE_CONFIG = {
  theme: {
    components: {
      Table: {
        cellPaddingBlock: 12,
        cellPaddingInline: 10,
      },
    },
  },
};

/**
 * Sizes an antd table's scrolling body to the space left in its container (above the pagination bar,
 * and above a fixed summary row) so the header stays in view. Re-measures when `deps` change and
 * whenever the container resizes.
 */
export const useTableScrollY = (deps: ReadonlyArray<unknown>) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState<number>(240);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const measure = () => {
      const header = element.querySelector<HTMLElement>('.ant-table-header')?.offsetHeight ?? 40;
      const summary = element.querySelector<HTMLElement>('.ant-table-summary')?.offsetHeight ?? 0;
      setScrollY(Math.max(120, element.clientHeight - header - summary - 2));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-measures when the caller's data changes
  }, deps);

  return { containerRef, scrollY };
};
