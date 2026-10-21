import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Empty, Table, theme } from '@/shared/antd-imports';
import type { ColumnsType, TableProps } from 'antd/es/table';
import TablePagination from '@/components/TablePagination';
import type { PortalPaging } from './usePortalPaging';
import { PortalLoadingOverlay } from './PortalLoader';

export interface PortalTableGrouping<T extends object> {
  /** Rows sharing a key sit under one header row; the server already returns them in key order. */
  getKey: (row: T) => string;
  renderHeader: (key: string, rows: T[]) => React.ReactNode;
}

interface GroupHeaderRow<T extends object> {
  isGroupHeader: true;
  groupKey: string;
  rows: T[];
}

const isGroupHeader = <T extends object>(row: T | GroupHeaderRow<T>): row is GroupHeaderRow<T> =>
  (row as GroupHeaderRow<T>).isGroupHeader === true;

interface PortalPagedTableProps<T extends object> {
  columns: ColumnsType<T>;
  rows: T[];
  rowKey: (row: T) => string;
  total: number;
  paging: PortalPaging;
  /** True only for the first load; a refetch keeps the old rows visible. */
  loading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  /** What the table says when there are no rows. Say what to do next, not just "No data". */
  emptyText: React.ReactNode;
  onRowClick?: (row: T) => void;
  /** Accessible name for the table. */
  ariaLabel: string;
  /** Sort and header-filter changes. The server applies them, so the table never reorders rows itself. */
  onTableChange?: TableProps<T>['onChange'];
  /** Adds a full-width header row whenever the key changes. A group that spans pages repeats its header. */
  grouping?: PortalTableGrouping<T>;

  rowSelection?: TableProps<T>['rowSelection'];
}

/**
 * The list shell every v2 page shares: loading, error with retry, an empty state, and the standard
 * 10/20/50/100 pagination bar. Rows are paged by the server, so the table never slices anything.
 */
export const PortalPagedTable = <T extends object>({
  columns,
  rows,
  rowKey,
  total,
  paging,
  loading,
  isError,
  onRetry,
  emptyText,
  onRowClick,
  ariaLabel,
  onTableChange,
  grouping,
  rowSelection,
}: PortalPagedTableProps<T>) => {
  const { t } = useTranslation('client-portal-v2');
  const { token } = theme.useToken();

  const groupedRows = React.useMemo(() => {
    if (!grouping) return null;
    const result: Array<T | GroupHeaderRow<T>> = [];
    let current: GroupHeaderRow<T> | null = null;
    rows.forEach(row => {
      const key = grouping.getKey(row);
      if (!current || current.groupKey !== key) {
        current = { isGroupHeader: true, groupKey: key, rows: [] };
        result.push(current);
      }
      current.rows.push(row);
      result.push(row);
    });
    return result;
  }, [grouping, rows]);

  // A header row spans every column: the first cell takes the whole width and the rest collapse.
  const tableColumns = React.useMemo(() => {
    if (!grouping) return columns;
    return columns.map((column, index) => {
      const original = column as { onCell?: (row: T, rowIndex?: number) => React.HTMLAttributes<HTMLElement> };
      const render = (column as { render?: (value: unknown, row: T, rowIndex: number) => React.ReactNode }).render;
      return {
        ...column,
        onCell: (row: T | GroupHeaderRow<T>, rowIndex?: number) =>
          isGroupHeader(row)
            ? ({
                colSpan: index === 0 ? columns.length : 0,
                style: { background: token.colorFillQuaternary, fontWeight: 600 },
              } as React.HTMLAttributes<HTMLElement>)
            : (original.onCell?.(row, rowIndex) ?? {}),
        render: (value: unknown, row: T | GroupHeaderRow<T>, rowIndex: number) => {
          if (isGroupHeader(row)) return index === 0 ? grouping.renderHeader(row.groupKey, row.rows) : null;
          return render ? render(value, row, rowIndex) : (value as React.ReactNode);
        },
      };
    }) as ColumnsType<T>;
  }, [columns, grouping, token.colorFillQuaternary]);

  if (isError) {
    return (
      <Alert
        type="error"
        showIcon
        message={t('listLoadError', { defaultValue: 'This list could not be loaded.' })}
        action={
          onRetry ? (
            <Button size="small" onClick={onRetry}>
              {t('retry', { defaultValue: 'Retry' })}
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div
      style={{
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 8,
        background: token.colorBgContainer,
        overflow: 'hidden',
      }}
    >
      <PortalLoadingOverlay loading={loading}>
        <Table<T>
          aria-label={ariaLabel}
          size="middle"
          columns={tableColumns}
          dataSource={(groupedRows ?? rows) as T[]}
          rowKey={(row: T) =>
            isGroupHeader(row as T | GroupHeaderRow<T>)
              ? `group:${(row as unknown as GroupHeaderRow<T>).groupKey}:${(row as unknown as GroupHeaderRow<T>).rows.length}`
              : rowKey(row)
          }
          pagination={false}
          rowSelection={grouping ? undefined : rowSelection}
          onChange={onTableChange}
          showSorterTooltip={false}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} /> }}
          onRow={
            onRowClick
              ? row =>
                  isGroupHeader(row as T | GroupHeaderRow<T>)
                    ? {}
                    : {
                        onClick: () => onRowClick(row),
                        style: { cursor: 'pointer' },
                      }
              : undefined
          }
        />
      </PortalLoadingOverlay>
      {total > 0 && (
        <TablePagination
          page={paging.page}
          pageSize={paging.limit}
          total={total}
          onPageChange={(page, pageSize) => paging.setPage(page, pageSize)}
          rowsPerPageLabel={t('rowsPerPage', { defaultValue: 'Rows per page:' })}
        />
      )}
    </div>
  );
};
