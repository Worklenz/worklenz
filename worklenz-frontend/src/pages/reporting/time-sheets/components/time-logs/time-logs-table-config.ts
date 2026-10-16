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
 *
 * With `fitContent` the container is not stretched to fill its card: the card shrinks to the rows
 * (up to the space its own parent offers), so the available height is measured from the card's
 * parent instead of from the container, which would otherwise depend on its own content.
 */
export const useTableScrollY = (deps: ReadonlyArray<unknown>, fitContent = false) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState<number>(240);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const measure = () => {
      const header = element.querySelector<HTMLElement>('.ant-table-header')?.offsetHeight ?? 40;
      const summary = element.querySelector<HTMLElement>('.ant-table-summary')?.offsetHeight ?? 0;
      let available = element.clientHeight;
      const card = element.parentElement;
      const cardParent = card?.parentElement;
      if (fitContent && card && cardParent) {
        const siblings = Array.from(card.children).reduce(
          (sum, child) => (child === element ? sum : sum + (child as HTMLElement).offsetHeight),
          0
        );
        // 2px for the card's border.
        available = cardParent.clientHeight - siblings - 2;
      }
      setScrollY(Math.max(120, available - header - summary - 2));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (fitContent && element.parentElement?.parentElement) {
      observer.observe(element.parentElement.parentElement);
    }
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-measures when the caller's data changes
  }, [...deps, fitContent]);

  return { containerRef, scrollY };
};
