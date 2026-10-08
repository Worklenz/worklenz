import { DependencyList, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Measures the width of the vertical scrollbar of an element whose rows scroll.
 *
 * When the rows overflow, the scrollbar takes width from the content inside the element (a table's
 * header and total row follow it automatically) but not from what sits *beside* it — like the
 * pagination bar below. That bar insets itself by this width to stay lined up with the data.
 * It is 0 for overlay scrollbars and while nothing overflows.
 *
 * `remeasureOn` lists what can change the answer (the rows, the page size, a loading state) and
 * the element being mounted at all; a ResizeObserver covers the scrollbar appearing or vanishing
 * as the rows grow past, or shrink under, the available height.
 */
export const useScrollbarGutter = (remeasureOn: DependencyList) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);

  const measure = useCallback(() => {
    const area = scrollAreaRef.current;
    if (!area) return;
    const gutter = Math.max(0, area.offsetWidth - area.clientWidth);
    setScrollbarWidth(prev => (prev === gutter ? prev : gutter));
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- the caller names what to remeasure on
  useLayoutEffect(measure, [measure, ...remeasureOn]);

  useEffect(() => {
    const area = scrollAreaRef.current;
    if (!area || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => measure());
    observer.observe(area);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the caller names what to remeasure on
  }, [measure, ...remeasureOn]);

  return { scrollAreaRef, scrollbarWidth };
};
