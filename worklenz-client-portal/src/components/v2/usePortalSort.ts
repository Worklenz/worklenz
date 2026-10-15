import { useCallback, useState } from 'react';
import type { SorterResult } from 'antd/es/table/interface';

export interface PortalSort {
  sort: string | undefined;
  order: 'asc' | 'desc' | undefined;
  /** Column props that make a header sortable and show the current direction. */
  columnProps: (key: string) => { sorter: true; sortOrder: 'ascend' | 'descend' | null };
  /** Feed it the sorter Ant Design reports from the table's onChange. */
  applySorter: <T extends object>(sorter: SorterResult<T> | SorterResult<T>[]) => void;
}

/** Which column a list is ordered by. The server does the ordering; this only tracks the choice. */
export const usePortalSort = (): PortalSort => {
  const [state, setState] = useState<{ sort?: string; order?: 'asc' | 'desc' }>({});

  const applySorter = useCallback(<T extends object>(sorter: SorterResult<T> | SorterResult<T>[]) => {
    const single = Array.isArray(sorter) ? sorter[0] : sorter;
    if (!single?.order || single.columnKey === undefined) {
      setState({});
      return;
    }
    setState({ sort: String(single.columnKey), order: single.order === 'descend' ? 'desc' : 'asc' });
  }, []);

  const columnProps = (key: string) => ({
    sorter: true as const,
    sortOrder: state.sort === key ? (state.order === 'desc' ? ('descend' as const) : ('ascend' as const)) : null,
  });

  return { sort: state.sort, order: state.order, columnProps, applySorter };
};
