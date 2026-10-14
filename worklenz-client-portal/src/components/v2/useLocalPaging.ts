import { useMemo, useState } from 'react';
import { usePortalSort } from './usePortalSort';

type SortValue = string | number | null | undefined;

/** Fallback page size; matches the rows-per-page select. */
const DEFAULT_PAGE_SIZE = 10;

/**
 * Sorting and paging for a list the page already holds in full (approvals, change requests). Search and
 * filters happen before this, so `rows` is what the person should see across all pages. Header clicks feed
 * `sorting`, and `sortValues` says what each sortable column key sorts by.
 */
export const useLocalPaging = <T,>(rows: T[], sortValues: Record<string, (row: T) => SortValue>) => {
  const sorting = usePortalSort();
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(DEFAULT_PAGE_SIZE);

  const sorted = useMemo(() => {
    const read = sorting.sort ? sortValues[sorting.sort] : undefined;
    if (!read) return rows;
    const direction = sorting.order === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => {
      const left = read(a);
      const right = read(b);
      if (left === right) return 0;
      if (left === null || left === undefined || left === '') return 1;
      if (right === null || right === undefined || right === '') return -1;
      if (typeof left === 'number' && typeof right === 'number') return (left - right) * direction;
      return String(left).localeCompare(String(right)) * direction;
    });
    // sortValues is a fresh object each render; the key and order are what change the result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sorting.sort, sorting.order]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / size));
  const safePage = Math.min(page, totalPages);
  const pageRows = sorted.slice((safePage - 1) * size, safePage * size);

  return {
    sorting,
    page: safePage,
    size,
    total: sorted.length,
    pageRows,
    resetPage: () => setPage(1),
    onPageChange: (nextPage: number, nextSize: number) => {
      setPage(nextPage);
      setSize(nextSize);
    },
  };
};
