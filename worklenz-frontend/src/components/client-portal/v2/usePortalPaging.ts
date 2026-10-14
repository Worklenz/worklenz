import { useCallback, useState } from 'react';

export const PORTAL_PAGE_SIZE = 10;

export interface PortalPaging {
  page: number;
  limit: number;
  /** Changing the page size also returns to page 1, so the user never lands past the last page. */
  setPage: (page: number, limit?: number) => void;
  /** Call when a filter changes: results start again from page 1. */
  reset: () => void;
}

/** Page and page size for a v2 list, defaulting to 10 rows. */
export const usePortalPaging = (initialLimit = PORTAL_PAGE_SIZE): PortalPaging => {
  const [state, setState] = useState({ page: 1, limit: initialLimit });

  const setPage = useCallback((page: number, limit?: number) => {
    setState(previous => {
      const nextLimit = limit ?? previous.limit;
      return { page: nextLimit === previous.limit ? page : 1, limit: nextLimit };
    });
  }, []);

  const reset = useCallback(() => setState(previous => ({ ...previous, page: 1 })), []);

  return { page: state.page, limit: state.limit, setPage, reset };
};
