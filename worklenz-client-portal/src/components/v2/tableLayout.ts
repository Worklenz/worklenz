import type { ColumnsType } from 'antd/es/table';
import type { KeyboardEvent } from 'react';

/**
 * Body height for a table that scrolls its rows inside itself (the header stays put) instead of
 * scrolling the page. `reservedPx` is what sits above and below the table: page header, toolbar, tabs,
 * pagination bar.
 */
export const tableBodyHeight = (reservedPx: number): string => `max(240px, calc(100vh - ${reservedPx}px))`;

/** Row props that make a whole row click- and keyboard-activatable (Enter / Space on the focused row). */
export const clickableRow = (open: () => void) => ({
  onClick: open,
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
    if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      open();
    }
  },
  tabIndex: 0,
  style: { cursor: 'pointer' },
});

/**
 * Gives every titled column a minimum width that fits its header text and sort arrows. The fixed-header
 * table measures its header and body separately, so without this a narrow column lets its title run
 * into the sort icon or the next title.
 */
export const withHeaderMinWidth = <T extends object>(columns: ColumnsType<T>): ColumnsType<T> =>
  columns.map(column => {
    if (typeof column.title !== 'string' || column.title === '' || column.width) return column;
    const minWidth = column.title.length * 8 + (column.sorter ? 60 : 36);
    return {
      ...column,
      onHeaderCell: () => ({ style: { minWidth } }),
      onCell: () => ({ style: { minWidth } }),
    };
  });
