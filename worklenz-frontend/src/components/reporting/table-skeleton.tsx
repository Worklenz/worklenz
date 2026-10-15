import { Skeleton } from '@/shared/antd-imports';
import type { TableColumnsType } from '@/shared/antd-imports';

export const SKELETON_ROW_COUNT = 10;

// Placeholder records for a table's first load; only `id` is set so the row key stays stable.
export const buildSkeletonRows = <T extends { id?: string }>(count: number): T[] =>
  Array.from({ length: Math.min(count, SKELETON_ROW_COUNT) }, (_, i) => ({
    id: `skeleton-${i}`,
  })) as T[];

// Swaps every cell renderer for a pulsing placeholder; headers, widths and fixed columns are kept
// so the layout does not jump when the real rows arrive.
export const toSkeletonColumns = <T extends object>(
  columns: TableColumnsType<T>
): TableColumnsType<T> =>
  columns.map(column => ({
    ...column,
    onCell: undefined,
    render: () => (
      <Skeleton.Input active size="small" block style={{ height: 16, minWidth: 0 }} />
    ),
  })) as TableColumnsType<T>;
