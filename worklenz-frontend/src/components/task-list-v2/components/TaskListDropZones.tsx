import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import { ColumnConfig } from '../constants/columns';

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
