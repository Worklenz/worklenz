import React from 'react';
import { DragOverlay } from '@dnd-kit/core';
import { HolderOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { Task } from '@/types/task-management.types';
import { ColumnConfig } from '../constants/columns';

export interface TaskListDragOverlayProps {
  activeId: string | null;
  allTasks: Task[];
  visibleColumns: ColumnConfig[];
}

export const TaskListDragOverlay: React.FC<TaskListDragOverlayProps> = React.memo(({
  activeId,
  allTasks,
  visibleColumns,
}) => {
  const { t } = useTranslation('task-list-table');
  const activeTask = activeId ? allTasks.find(task => task.id === activeId) : null;
  const titleWidth = visibleColumns.find(col => col.id === 'title')?.width || '300px';

  return (
    <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
      {activeId ? (
        <div
          className="bg-white dark:bg-gray-800 shadow-2xl rounded-lg border-2 border-blue-500 dark:border-blue-400 opacity-95"
          style={{ width: titleWidth }}
        >
          <div className="px-4 py-3">
            <div className="flex items-center gap-3">
              <HolderOutlined className="text-blue-500 dark:text-blue-400 text-sm" />
              <div className="text-sm font-medium text-gray-900 dark:text-white truncate flex-1">
                {activeTask?.name || activeTask?.title || t('emptyStates.dragTaskFallback')}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </DragOverlay>
  );
});

TaskListDragOverlay.displayName = 'TaskListDragOverlay';
