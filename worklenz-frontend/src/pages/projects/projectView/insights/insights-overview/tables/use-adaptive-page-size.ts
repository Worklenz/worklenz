import { useEffect, useState } from 'react';

const ROW_HEIGHT_FALLBACK = 34;
const MIN_ROWS = 10;
const MAX_ROWS = 100;
const BOTTOM_GAP = 24;
const DEFAULT_PAGE_SIZE = 10;

export interface AdaptivePageSize {
  pageSize: number;
  /** True once the table has been measured, so consumers can wait before fetching. */
  isReady: boolean;
}

const clampRows = (rows: number) => Math.max(MIN_ROWS, Math.min(MAX_ROWS, rows));

/**
 * Works out how many table rows fit between the table and the bottom of the
 * insights scroll container, and keeps that number in sync with window and
 * container resizes (so tables adapt instead of pushing the page taller).
 *
 * The container is found via `data-insights-scroll-container`; when it is not
 * available the viewport is used as a fallback.
 */
export const useAdaptivePageSize = (
  tableRef: { current: HTMLElement | null }
): AdaptivePageSize => {
  const [state, setState] = useState<AdaptivePageSize>({
    pageSize: DEFAULT_PAGE_SIZE,
    isReady: false,
  });

  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;

    const scrollContainer = table.closest('[data-insights-scroll-container]') as HTMLElement | null;

    const measure = () => {
      const headerHeight =
        table.querySelector('.ant-table-thead')?.getBoundingClientRect().height ?? 0;
      const firstRow = table.querySelector('.ant-table-tbody tr');
      const rowHeight = firstRow?.getBoundingClientRect().height || ROW_HEIGHT_FALLBACK;
      const paginationHeight =
        table.querySelector('.ant-pagination')?.getBoundingClientRect().height ?? 0;

      const containerHeight = scrollContainer?.clientHeight ?? window.innerHeight;
      const containerTop = scrollContainer?.getBoundingClientRect().top ?? 0;
      const tableTop =
        table.getBoundingClientRect().top - containerTop + (scrollContainer?.scrollTop ?? 0);

      const available =
        containerHeight - tableTop - headerHeight - paginationHeight - BOTTOM_GAP;
      const rows = clampRows(Math.floor(available / rowHeight));

      setState(previous =>
        previous.isReady && previous.pageSize === rows
          ? previous
          : { pageSize: rows, isReady: true }
      );
    };

    measure();

    const observer = new ResizeObserver(measure);
    if (scrollContainer) observer.observe(scrollContainer);
    observer.observe(table);
    window.addEventListener('resize', measure);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [tableRef]);

  return state;
};
