import React, { useMemo } from 'react';
import { theme } from '@/shared/antd-imports';

export interface TablePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number, pageSize: number) => void;
  pageSizeOptions?: number[];
  rowsPerPageLabel: string;
  /** Given the "start-end" range text and the total count, render the summary label. */
  renderSummary?: (range: string, total: number) => React.ReactNode;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50];

/**
 * Rows-per-page select + "start-end of total" summary + first/prev/page/next/last
 * buttons. Shared by tables that render their own pagination bar below an antd
 * <Table pagination={false} /> instead of using antd's built-in pagination.
 */
const TablePagination: React.FC<TablePaginationProps> = ({
  page,
  pageSize,
  total,
  onPageChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  rowsPerPageLabel,
  renderSummary,
}) => {
  const { token } = theme.useToken();

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  const pageNumbers = useMemo(() => {
    const nums: (number | '…')[] = [];
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
      p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1
    );
    pages.forEach((p, i) => {
      if (i > 0 && p - (pages[i - 1] as number) > 1) nums.push('…');
      nums.push(p);
    });
    return nums;
  }, [totalPages, safePage]);

  const selectStyle: React.CSSProperties = {
    height: 32,
    fontSize: 12,
    padding: '0 10px',
    border: `1px solid ${token.colorBorder}`,
    borderRadius: 6,
    background: token.colorBgContainer,
    color: token.colorText,
    outline: 'none',
    cursor: 'pointer',
    width: 68,
  };

  const pageBtnStyle = (active: boolean): React.CSSProperties => ({
    minWidth: 28,
    height: 28,
    border: `1px solid ${token.colorBorder}`,
    borderRadius: 5,
    cursor: active ? 'pointer' : 'default',
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: active ? '#1677ff' : 'transparent',
    color: active ? '#fff' : token.colorText,
    transition: 'all .1s',
    padding: '0 4px',
  });

  const navBtnStyle = (enabled: boolean): React.CSSProperties => ({
    minWidth: 28,
    height: 28,
    border: `1px solid ${token.colorBorder}`,
    borderRadius: 5,
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontSize: 13,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    color: enabled ? token.colorText : token.colorTextDisabled,
    transition: 'all .1s',
    padding: '0 4px',
  });

  if (total === 0) return null;

  const range =
    total === 0 ? '0' : `${(safePage - 1) * pageSize + 1}-${Math.min(safePage * pageSize, total)}`;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        rowGap: 8,
        padding: '10px 16px',
        borderTop: `1px solid ${token.colorBorderSecondary}`,
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', rowGap: 4 }}>
        <span style={{ fontSize: 12, color: token.colorTextSecondary }}>{rowsPerPageLabel}</span>
        <select
          style={selectStyle}
          value={pageSize}
          onChange={e => onPageChange(1, Number(e.target.value))}
        >
          {pageSizeOptions.map(n => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span style={{ fontSize: 12, color: token.colorTextSecondary, marginLeft: 4 }}>
          {renderSummary ? renderSummary(range, total) : `${range} of ${total}`}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap', rowGap: 4 }}>
        <button
          style={navBtnStyle(safePage > 1)}
          disabled={safePage === 1}
          onClick={() => onPageChange(1, pageSize)}
        >
          «
        </button>
        <button
          style={navBtnStyle(safePage > 1)}
          disabled={safePage === 1}
          onClick={() => onPageChange(Math.max(1, safePage - 1), pageSize)}
        >
          ‹
        </button>
        {pageNumbers.map((p, i) =>
          typeof p === 'number' ? (
            <button
              key={i}
              style={pageBtnStyle(p === safePage)}
              onClick={() => onPageChange(p, pageSize)}
            >
              {p}
            </button>
          ) : (
            <span key={i} style={{ fontSize: 12, padding: '0 4px', opacity: 0.5 }}>
              …
            </span>
          )
        )}
        <button
          style={navBtnStyle(safePage < totalPages)}
          disabled={safePage === totalPages}
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1), pageSize)}
        >
          ›
        </button>
        <button
          style={navBtnStyle(safePage < totalPages)}
          disabled={safePage === totalPages}
          onClick={() => onPageChange(totalPages, pageSize)}
        >
          »
        </button>
      </div>
    </div>
  );
};

export default TablePagination;
