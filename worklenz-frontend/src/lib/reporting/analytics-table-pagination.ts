import type { TablePaginationConfig } from 'antd/es/table';
import { PAGE_SIZE_OPTIONS } from '@/shared/constants';

/**
 * Client-side Ant Design Table pagination.
 * Uses `defaultPageSize` (uncontrolled) so the page-size dropdown can update
 * the visible row count. Passing a fixed `pageSize` without state/`onChange`
 * leaves the size changer stuck on the initial value.
 */
export const getClientTablePagination = (
  defaultPageSize = 20
): TablePaginationConfig => ({
  defaultPageSize,
  showSizeChanger: true,
  pageSizeOptions: PAGE_SIZE_OPTIONS,
});
