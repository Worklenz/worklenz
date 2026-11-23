import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { theme } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { isSoftwareProjectType } from '@/lib/project/software-project';
import type { ColumnConfig } from '../constants/columns';
import { AddCustomColumnButton, CustomColumnHeader } from './CustomColumnComponents';

interface BacklogSectionColumnHeaderProps {
  visibleColumns: ColumnConfig[];
  /** List-level bar that stays fixed while issue rows scroll. */
  pinned?: boolean;
  isActiveSprint?: boolean;
  isGuest?: boolean;
  handleCustomColumnSettings?: (columnKey: string) => void;
}

/** Compact column labels for the software Backlog. Pinned above the sprint headers. */
export const BacklogSectionColumnHeader: React.FC<BacklogSectionColumnHeaderProps> = memo(
  ({
    visibleColumns,
    pinned = false,
    isActiveSprint = false,
    isGuest = false,
    handleCustomColumnSettings,
  }) => {
    const { t } = useTranslation('task-list-table');
    const { token } = theme.useToken();
    const projectType = useAppSelector(state => state.projectReducer.project?.project_type);
    const showAddCustomColumn = isSoftwareProjectType(projectType);

    return (
      <div
        className="flex items-center px-1 text-[10px] font-bold uppercase tracking-[0.35px]"
        style={{
          minWidth: 'max-content',
          height: 32,
          background: token.colorBgContainer,
          color: token.colorTextSecondary,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          ...(!pinned && {
            borderLeft: isActiveSprint
              ? `3px solid ${token.colorPrimary}`
              : `1px solid ${token.colorBorderSecondary}`,
            borderRight: `1px solid ${token.colorBorderSecondary}`,
          }),
        }}
      >
        {visibleColumns.map((column, index) => {
          let leftPosition = 0;
          if (column.isSticky) {
            for (let i = 0; i < index; i++) {
              const previousWidth = parseInt(
                String(visibleColumns[i].width ?? '0').replace('px', ''),
                10
              );
              leftPosition += previousWidth || 0;
            }
          }
          const showLabel = column.id !== 'dragHandle' && column.id !== 'checkbox';

          return (
            <div
              key={column.id}
              className="truncate px-2"
              style={{
                width: `var(--col-width-${column.id})`,
                flexShrink: 0,
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                position: 'relative',
                borderRight: `1px solid ${token.colorBorderSecondary}`,
                ...(typeof column.minWidth === 'string' && { minWidth: column.minWidth }),
                ...(typeof column.maxWidth === 'string' && { maxWidth: column.maxWidth }),
                ...(column.isSticky && {
                  position: 'sticky' as const,
                  left: leftPosition,
                  zIndex: 6,
                  background: token.colorBgContainer,
                }),
              }}
            >
              {!showLabel ? null : column.isCustom && handleCustomColumnSettings ? (
                <CustomColumnHeader
                  column={column}
                  onSettingsClick={handleCustomColumnSettings}
                  isGuest={isGuest}
                />
              ) : (
                t(column.label, { defaultValue: column.label })
              )}
            </div>
          );
        })}
        {showAddCustomColumn && (
          <div
            className="flex items-center justify-center shrink-0"
            style={{
              width: 40,
              height: '100%',
              borderRight: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <AddCustomColumnButton compact />
          </div>
        )}
      </div>
    );
  }
);

BacklogSectionColumnHeader.displayName = 'BacklogSectionColumnHeader';
