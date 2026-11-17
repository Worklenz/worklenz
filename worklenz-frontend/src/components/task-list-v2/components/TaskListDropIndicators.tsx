import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { PlusOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import type { ColumnConfig } from '../constants/columns';

// Drop Spacer Component - creates space between tasks when dragging
export const DropSpacer: React.FC<{
  isVisible: boolean;
  visibleColumns: ColumnConfig[];
  isDarkMode?: boolean;
}> = ({ isVisible, visibleColumns }) => {
  const { t } = useTranslation('task-list-table');
  if (!isVisible) return null;

  return (
    <div
      className="flex items-center min-w-max px-1 border-2 border-dashed border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20 transition-all duration-200 ease-in-out"
      style={{
        height: isVisible ? '40px' : '0px',
        opacity: isVisible ? 1 : 0,
        marginTop: isVisible ? '2px' : '0px',
        marginBottom: isVisible ? '2px' : '0px',
        overflow: 'hidden',
      }}
    >
      {visibleColumns.map((column, index) => {
        // Calculate left position for sticky columns
        let leftPosition = 0; // Start at 0 to cover the row's left padding
        if (column.isSticky) {
          for (let i = 0; i < index; i++) {
            const prevColumn = visibleColumns[i];
            leftPosition += parseInt(prevColumn.width.replace('px', ''));
          }
        }

        const columnStyle = {
          width: column.width,
          flexShrink: 0,
          ...(column.isSticky && {
            position: 'sticky' as const,
            left: leftPosition,
            zIndex: 10,
            backgroundColor: 'inherit', // Inherit from parent spacer
          }),
        };

        if (column.id === 'title') {
          return (
            <div
              key={`spacer-${column.id}`}
              className="flex items-center pl-1 border-r border-blue-300 dark:border-blue-600"
              style={columnStyle}
            >
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                {t('dropHere', { defaultValue: 'Drop here' })}
              </span>
            </div>
          );
        }

        return (
          <div
            key={`spacer-${column.id}`}
            className={`border-r border-blue-300 dark:border-blue-600 ${column.id === 'dragHandle' ? 'pl-1' : ''}`}
            style={columnStyle}
          />
        );
      })}
    </div>
  );
};

export const GroupDropZone: React.FC<{
  groupId: string;
  isActive: boolean;
  children: React.ReactNode;
}> = ({ groupId, isActive, children }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `group-drop-${groupId}`,
    data: {
      type: 'group',
      groupId,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`transition-colors ${
        isActive || isOver
          ? 'ring-2 ring-blue-400 dark:ring-blue-500 bg-blue-50/60 dark:bg-blue-900/20'
          : ''
      }`}
    >
      {children}
    </div>
  );
};

export const InsertTaskDivider: React.FC<{
  onInsert: () => void;
  title: string;
  isVisible: boolean;
  isNearGroupHeader: boolean;
}> = ({ onInsert, title, isVisible, isNearGroupHeader }) => {
  if (!isVisible || isNearGroupHeader) return null;

  return (
    <div className="group absolute inset-x-0 top-0 h-3 -translate-y-1/2" style={{ zIndex: 5 }}>
      <div className="relative h-full w-full">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-blue-400 dark:border-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        <button
          data-insert-btn
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={e => {
            e.stopPropagation();
            onInsert();
          }}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-4 w-4 rounded-full border border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900 text-[10px] text-blue-600 dark:text-blue-300 opacity-0 group-hover:opacity-100 focus:opacity-100 flex items-center justify-center shadow-sm"
          style={{ left: 32 }}
          title={title}
          aria-label={title}
        >
          <PlusOutlined />
        </button>
      </div>
    </div>
  );
};
