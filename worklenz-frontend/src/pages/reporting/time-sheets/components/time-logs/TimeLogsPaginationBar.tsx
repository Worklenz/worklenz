import React, { useId } from 'react';
import { Button, Flex, Pagination, theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { PAGE_SIZE_OPTIONS } from '@/shared/constants';

interface TimeLogsPaginationBarProps {
  page: number;
  pageSize: number;
  /** What the pager counts: entries, tasks or groups, depending on the screen. */
  total: number;
  /** (page, pageSize): a new page size always comes with page 1. */
  onPageChange: (page: number, pageSize: number) => void;
}

/** The Projects report table's pagination bar: rows per page, range, first / pages / last. */
export const TimeLogsPaginationBar: React.FC<TimeLogsPaginationBarProps> = ({
  page,
  pageSize,
  total,
  onPageChange,
}) => {
  const { t } = useTranslation('time-report');
  const { token } = theme.useToken();
  const selectId = useId();

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Flex
      align="center"
      justify="space-between"
      gap={12}
      wrap="wrap"
      className="px-4 py-3"
      style={{ borderTop: `1px solid ${token.colorBorderSecondary}`, flexShrink: 0 }}
    >
      <Flex align="center" gap={8}>
        <label htmlFor={selectId} className="text-xs">
          {t('timeLogsRowsPerPageLabel', { defaultValue: 'Rows per page:' })}
        </label>
        <select
          id={selectId}
          value={pageSize}
          onChange={event => onPageChange(1, Number(event.target.value))}
          className="rounded-md border px-2 py-1 text-xs"
          style={{
            background: token.colorBgContainer,
            color: token.colorText,
            borderColor: token.colorBorder,
          }}
        >
          {PAGE_SIZE_OPTIONS.map(size => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <span className="text-xs" style={{ color: token.colorTextSecondary }}>
          {t('timeLogsRangeOfTotal', {
            start: rangeStart,
            end: rangeEnd,
            total,
            defaultValue: '{{start}}-{{end}} of {{total}}',
          })}
        </span>
      </Flex>
      <Flex align="center" gap={8}>
        <Button
          size="small"
          aria-label={t('timeLogsFirstPage', { defaultValue: 'First page' })}
          disabled={page <= 1}
          onClick={() => onPageChange(1, pageSize)}
        >
          «
        </Button>
        <Pagination
          current={page}
          pageSize={pageSize}
          total={total}
          showSizeChanger={false}
          onChange={nextPage => onPageChange(nextPage, pageSize)}
        />
        <Button
          size="small"
          aria-label={t('timeLogsLastPage', { defaultValue: 'Last page' })}
          disabled={page >= lastPage}
          onClick={() => onPageChange(lastPage, pageSize)}
        >
          »
        </Button>
      </Flex>
    </Flex>
  );
};
