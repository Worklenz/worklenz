import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { theme } from '@/shared/antd-imports';

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

interface TablePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number, pageSize: number) => void;
  pageSizeOptions?: number[];
}

/**
 * Rows-per-page select, "start-end of total" summary and first/prev/page/next/last buttons.
 * Same bar as the admin console tables; sits under an antd <Table pagination={false} />.
 */
export const TablePagination: React.FC<TablePaginationProps> = ({
  page,
  pageSize,
  total,
  onPageChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
}) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  const pageNumbers = useMemo(() => {
    const nums: (number | '…')[] = [];
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
      p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1
    );
    pages.forEach((p, i) => {
      if (i > 0 && p - pages[i - 1] > 1) nums.push('…');
      nums.push(p);
    });
    return nums;
  }, [totalPages, safePage]);

  if (total === 0) return null;

  const rowsPerPageLabel = t('pagination.rowsPerPage', { defaultValue: 'Rows per page:' });
  const from = (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  const buttonStyle = (enabled: boolean, active = false): React.CSSProperties => ({
    minWidth: 28,
    height: 28,
    padding: '0 4px',
    border: `1px solid ${active ? token.colorPrimary : token.colorBorder}`,
    borderRadius: 5,
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: active ? token.colorPrimary : 'transparent',
    color: active ? token.colorTextLightSolid : enabled ? token.colorText : token.colorTextDisabled,
    transition: 'all .1s',
  });

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
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', rowGap: 4 }}>
        <span style={{ fontSize: 12, color: token.colorTextSecondary }}>{rowsPerPageLabel}</span>
        <select
          aria-label={rowsPerPageLabel}
          value={pageSize}
          onChange={event => onPageChange(1, Number(event.target.value))}
          style={{
            height: 32,
            width: 68,
            fontSize: 12,
            padding: '0 10px',
            border: `1px solid ${token.colorBorder}`,
            borderRadius: 6,
            background: token.colorBgContainer,
            color: token.colorText,
            cursor: 'pointer',
          }}
        >
          {pageSizeOptions.map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <span style={{ fontSize: 12, color: token.colorTextSecondary, marginLeft: 4 }}>
          {t('pagination.summary', { from, to, total, defaultValue: '{{from}}-{{to}} of {{total}}' })}
        </span>
      </div>

      <nav aria-label={t('pagination.label', { defaultValue: 'Pagination' })} style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap', rowGap: 4 }}>
        <button type="button" style={buttonStyle(safePage > 1)} disabled={safePage === 1} aria-label={t('pagination.first', { defaultValue: 'First page' })} onClick={() => onPageChange(1, pageSize)}>«</button>
        <button type="button" style={buttonStyle(safePage > 1)} disabled={safePage === 1} aria-label={t('pagination.prev', { defaultValue: 'Previous page' })} onClick={() => onPageChange(safePage - 1, pageSize)}>‹</button>
        {pageNumbers.map((p, i) =>
          typeof p === 'number' ? (
            <button
              type="button"
              key={i}
              style={buttonStyle(true, p === safePage)}
              aria-current={p === safePage ? 'page' : undefined}
              onClick={() => onPageChange(p, pageSize)}
            >
              {p}
            </button>
          ) : (
            <span key={i} style={{ fontSize: 12, padding: '0 4px', opacity: 0.5 }}>…</span>
          )
        )}
        <button type="button" style={buttonStyle(safePage < totalPages)} disabled={safePage === totalPages} aria-label={t('pagination.next', { defaultValue: 'Next page' })} onClick={() => onPageChange(safePage + 1, pageSize)}>›</button>
        <button type="button" style={buttonStyle(safePage < totalPages)} disabled={safePage === totalPages} aria-label={t('pagination.last', { defaultValue: 'Last page' })} onClick={() => onPageChange(totalPages, pageSize)}>»</button>
      </nav>
    </div>
  );
};
