import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { theme } from '@/shared/antd-imports';

interface BacklogSectionColumn {
  id: string;
  label: string;
  minWidth?: unknown;
  maxWidth?: unknown;
}

interface BacklogSectionColumnHeaderProps {
  visibleColumns: BacklogSectionColumn[];
  isActiveSprint: boolean;
}

/** Compact column labels repeated at the top of every software Backlog sprint card. */
export const BacklogSectionColumnHeader: React.FC<BacklogSectionColumnHeaderProps> = memo(
  ({ visibleColumns, isActiveSprint }) => {
    const { t } = useTranslation('task-list-table');
    const { token } = theme.useToken();

    return (
      <div
        aria-hidden="true"
        className="flex items-center px-1 min-h-[32px] text-[10px] font-bold uppercase tracking-[0.35px]"
        style={{
          minWidth: 'max-content',
          background: token.colorBgContainer,
          color: token.colorTextSecondary,
          borderLeft: isActiveSprint
            ? `3px solid ${token.colorPrimary}`
            : `1px solid ${token.colorBorderSecondary}`,
          borderRight: `1px solid ${token.colorBorderSecondary}`,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        {visibleColumns.map(column => (
          <div
            key={column.id}
            className="truncate px-2"
            style={{
              width: `var(--col-width-${column.id})`,
              flexShrink: 0,
              ...(typeof column.minWidth === 'string' && { minWidth: column.minWidth }),
              ...(typeof column.maxWidth === 'string' && { maxWidth: column.maxWidth }),
            }}
          >
            {column.id === 'dragHandle' || column.id === 'checkbox' ? null : t(column.label)}
          </div>
        ))}
      </div>
    );
  }
);

BacklogSectionColumnHeader.displayName = 'BacklogSectionColumnHeader';
