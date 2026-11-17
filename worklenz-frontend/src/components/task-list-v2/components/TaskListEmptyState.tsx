import React from 'react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import { Task } from '@/types/task-management.types';
import { ColumnConfig } from '../constants/columns';
import { TaskListColumnHeaders } from './TaskListColumnHeaders';
import TaskGroupHeader from '../TaskGroupHeader';
import { ExampleTaskRows } from './ExampleTaskRows';
import AddTaskRow from './AddTaskRow';

export interface TaskListEmptyStateProps {
  currentGrouping?: string | null;
  sensors: React.ComponentProps<typeof DndContext>['sensors'];
  onDragStart: React.ComponentProps<typeof DndContext>['onDragStart'];
  onDragOver: React.ComponentProps<typeof DndContext>['onDragOver'];
  onDragEnd: React.ComponentProps<typeof DndContext>['onDragEnd'];
  attachScrollContainer: (node: HTMLDivElement | null) => void;
  outerScrollRef: React.RefObject<HTMLDivElement | null>;
  contentScrollRef: React.RefObject<HTMLDivElement | null>;
  visibleColumns: ColumnConfig[];
  overColumnId: string | null;
  activeColumnId: string | null;
  columnSensors: React.ComponentProps<typeof DndContext>['sensors'];
  handleColumnDragStart: React.ComponentProps<typeof TaskListColumnHeaders>['handleColumnDragStart'];
  handleColumnDragOver: React.ComponentProps<typeof TaskListColumnHeaders>['handleColumnDragOver'];
  handleColumnDragEnd: React.ComponentProps<typeof TaskListColumnHeaders>['handleColumnDragEnd'];
  handleCustomColumnSettings: (columnKey: string) => void;
  columnWidths: Record<string, string>;
  setColumnWidths: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  isBacklogMode: boolean;
  isGuest: boolean;
  isDarkMode: boolean;
  projectId: string;
  hasNoTasks: boolean;
  canCreateTask: boolean;
  isWorkReadOnly: boolean;
  onTaskCreated: (
    task: Task,
    groupId: string,
    openDrawer: boolean,
    insertedAfterTaskId?: string | null
  ) => void;
}

export const TaskListEmptyState: React.FC<TaskListEmptyStateProps> = React.memo(({
  currentGrouping,
  sensors,
  onDragStart,
  onDragOver,
  onDragEnd,
  attachScrollContainer,
  outerScrollRef,
  contentScrollRef,
  visibleColumns,
  overColumnId,
  activeColumnId,
  columnSensors,
  handleColumnDragStart,
  handleColumnDragOver,
  handleColumnDragEnd,
  handleCustomColumnSettings,
  columnWidths,
  setColumnWidths,
  isBacklogMode,
  isGuest,
  isDarkMode,
  projectId,
  hasNoTasks,
  canCreateTask,
  isWorkReadOnly,
  onTaskCreated,
}) => {
  const { t } = useTranslation('task-list-table');

  // If grouped by phase, show an unmapped group to allow task creation
  if (currentGrouping === 'phase') {
    const unmappedGroupId = 'Unmapped';

    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="flex flex-col bg-[var(--tl-surface-bg)] h-full overflow-hidden">
          <div
            className="border border-gray-200 dark:border-gray-700 rounded-lg"
            style={{
              height: 'calc(100vh - 240px)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              ref={attachScrollContainer}
              className="flex-1 bg-[var(--tl-surface-bg)] relative"
              style={{ overflowX: 'auto', overflowY: 'auto', minHeight: 0 }}
            >
              <div
                ref={contentScrollRef}
                style={{ minWidth: 'max-content', overflowX: 'visible', overflowY: 'visible' }}
              >
                {/* Sticky Column Headers */}
                <div
                  className="sticky top-0 z-30 bg-[var(--tl-header-bg)] transition-colors duration-200"
                  style={{ minWidth: 'max-content' }}
                >
                  <TaskListColumnHeaders
                    visibleColumns={visibleColumns}
                    overColumnId={overColumnId}
                    activeColumnId={activeColumnId}
                    columnSensors={columnSensors}
                    handleColumnDragStart={handleColumnDragStart}
                    handleColumnDragOver={handleColumnDragOver}
                    handleColumnDragEnd={handleColumnDragEnd}
                    handleCustomColumnSettings={handleCustomColumnSettings}
                    columnWidths={columnWidths}
                    setColumnWidths={setColumnWidths}
                    outerScrollRef={outerScrollRef}
                    contentScrollRef={contentScrollRef}
                    isBacklogMode={isBacklogMode}
                    isGuest={isGuest}
                  />
                </div>

                <div style={{ minWidth: 'max-content' }}>
                  <div className="mt-2">
                    <TaskGroupHeader
                      group={{
                        id: unmappedGroupId,
                        name: 'Unmapped',
                        count: 0,
                        color: '#fbc84c69',
                      }}
                      isCollapsed={false}
                      onToggle={() => {}}
                      projectId={projectId}
                    />
                    {hasNoTasks && !isGuest && !isWorkReadOnly && (
                      <ExampleTaskRows
                        visibleColumns={visibleColumns}
                        isDarkMode={isDarkMode}
                        groupId={unmappedGroupId}
                        groupType="phase"
                        groupValue={unmappedGroupId}
                        groupName={unmappedGroupId}
                        groupColor="#fbc84c69"
                        projectId={projectId}
                        canCreateTask={canCreateTask}
                        interactive
                        onTaskCreated={(task, options) =>
                          onTaskCreated(task, unmappedGroupId, !!options?.openDrawer, null)
                        }
                      />
                    )}
                    {/* Single add task row - reused for all tasks */}
                    {canCreateTask && !isWorkReadOnly && (
                      <AddTaskRow
                        groupId={unmappedGroupId}
                        groupType="phase"
                        groupValue="Unmapped"
                        projectId={projectId}
                        visibleColumns={visibleColumns}
                        rowId={`add-task-${unmappedGroupId}-0`}
                        autoFocus={false}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DndContext>
    );
  }

  // For other groupings, show the empty state message
  return (
    <div className="flex flex-col bg-[var(--tl-surface-bg)] h-full">
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {t('emptyStates.noTaskGroups')}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t('emptyStates.noTaskGroupsDescription')}
          </div>
        </div>
      </div>
    </div>
  );
});

TaskListEmptyState.displayName = 'TaskListEmptyState';
