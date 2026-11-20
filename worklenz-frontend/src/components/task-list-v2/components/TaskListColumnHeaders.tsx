import React, { useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';
import { AddCustomColumnButton, CustomColumnHeader } from './CustomColumnComponents';
import type { ColumnConfig } from '../constants/columns';
import { isTaskListProfilingEnabled, recordTaskListRender } from '../task-list-profiling';
import { useColumnResize } from '../hooks/useColumnResize';

interface TaskListColumnHeadersProps {
  visibleColumns: ColumnConfig[];
  overColumnId: string | null;
  activeColumnId: string | null;
  columnSensors: React.ComponentProps<typeof DndContext>['sensors'];
  handleColumnDragStart: (event: DragStartEvent) => void;
  handleColumnDragOver: (event: DragOverEvent) => void;
  handleColumnDragEnd: (event: DragEndEvent) => void;
  handleCustomColumnSettings: (columnKey: string) => void;
  columnWidths: Record<string, string>;
  setColumnWidths: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  outerScrollRef: React.RefObject<HTMLDivElement | null>;
  contentScrollRef: React.RefObject<HTMLDivElement | null>;
  isBacklogMode: boolean;
  isGuest: boolean;
}

export const TaskListColumnHeaders = React.memo((props: TaskListColumnHeadersProps) => {
  const {
    visibleColumns,
    overColumnId,
    activeColumnId,
    columnSensors,
    handleColumnDragStart,
    handleColumnDragOver,
    handleColumnDragEnd,
    handleCustomColumnSettings,
    isBacklogMode,
    isGuest,
  } = props;
  const { t } = useTranslation('task-list-table');
  const { handleResizeKeyDown, handleResizeMouseDown } = useColumnResize(props);
  const reorderableColumnIds = useMemo(
    () => visibleColumns.filter(column => !column.isSticky).map(column => column.id),
    [visibleColumns]
  );

  const header = (
    <DndContext
      sensors={columnSensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToHorizontalAxis]}
      onDragStart={handleColumnDragStart}
      onDragOver={handleColumnDragOver}
      onDragEnd={handleColumnDragEnd}
    >
      <SortableContext items={reorderableColumnIds} strategy={horizontalListSortingStrategy}>
        <div
          className="border-b border-gray-200 dark:border-gray-700 tasklist-v2-column-headers"
          style={{
            width: '100%',
            minWidth: 'max-content',
            backgroundColor: 'var(--tl-header-bg)',
            transition:
              'background-color 200ms cubic-bezier(0.4, 0, 0.2, 1), border-color 200ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <div
            className="flex items-center px-1 py-3 w-full"
            style={{ minWidth: 'max-content', height: '40px' }}
          >
            {visibleColumns.map((column, index) => {
              const isDropTarget = overColumnId === column.id && column.id !== activeColumnId;

              // Calculate left position for sticky columns
              let leftPosition = 0; // Start at 0 to cover the row's left padding
              if (column.isSticky) {
                // For sticky columns, we need to account for ALL previous columns
                // because non-sticky columns between sticky ones still take up space
                for (let i = 0; i < index; i++) {
                  const prevColumn = visibleColumns[i];
                  leftPosition += parseInt(prevColumn.width.replace('px', ''));
                }
              }

              const columnStyle: React.CSSProperties = {
                width: `var(--col-width-${column.id})`,
                flexShrink: 0,
                ...(column.minWidth && { minWidth: column.minWidth }),
                ...(column.maxWidth && { maxWidth: column.maxWidth }),
                ...(column.isSticky && {
                  position: 'sticky' as const,
                  left: leftPosition,
                  zIndex: 15,
                  backgroundColor: 'var(--tl-header-bg)',
                  transition:
                    'background-color 200ms cubic-bezier(0.4, 0, 0.2, 1), border-color 200ms cubic-bezier(0.4, 0, 0.2, 1)',
                  height: '100%', // Fill the header height
                  display: 'flex', // Use flex to contain child
                  alignItems: 'center', // Center content vertically
                }),
              };

              const headerContent = (dragParams?: {
                attributes: ReturnType<typeof useSortable>['attributes'];
                listeners: ReturnType<typeof useSortable>['listeners'];
                setActivatorNodeRef: (element: HTMLElement | null) => void;
                isDragging: boolean;
              }) => (
                <div
                  data-column-id={column.id}
                  className={`text-sm font-semibold text-gray-600 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 column-header-cell h-full w-full ${
                    column.id === 'dragHandle'
                      ? 'flex items-center justify-center pl-1'
                      : column.id === 'checkbox'
                        ? 'flex items-center justify-center'
                        : column.id === 'taskKey'
                          ? 'flex items-center pl-3'
                          : column.id === 'title'
                            ? 'flex items-center justify-between px-2'
                            : column.id === 'description'
                              ? 'flex items-center pl-2'
                              : column.id === 'labels'
                                ? 'flex items-center min-w-0 px-2'
                                : column.id === 'assignees'
                                  ? 'flex items-center px-2'
                                  : 'flex items-center justify-center px-2'
                  } ${isDropTarget ? 'column-drop-target' : ''}`}
                  style={{
                    // For sticky columns, apply the full columnStyle here
                    // For non-sticky columns, the SortableHeader wrapper handles width
                    ...(column.isSticky ? columnStyle : {}),
                    // Add position relative for resize handle positioning, but don't override sticky
                    ...(!column.isSticky && { position: 'relative' }),
                    ...(dragParams?.isDragging ? { opacity: 0.85 } : {}),
                  }}
                >
                  {column.id === 'dragHandle' || column.id === 'checkbox' ? (
                    <span></span>
                  ) : column.isCustom ? (
                    <CustomColumnHeader
                      column={column}
                      onSettingsClick={handleCustomColumnSettings}
                      dragListeners={!column.isSticky ? dragParams?.listeners : undefined}
                      dragAttributes={!column.isSticky ? dragParams?.attributes : undefined}
                      setDragActivatorRef={
                        !column.isSticky ? dragParams?.setActivatorNodeRef : undefined
                      }
                      isGuest={isGuest}
                    />
                  ) : (
                    <span
                      ref={dragParams?.setActivatorNodeRef}
                      {...dragParams?.attributes}
                      {...dragParams?.listeners}
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        paddingRight: '20px',
                        flex: 1,
                        cursor: !column.isSticky ? 'grab' : 'default',
                      }}
                    >
                      {t(column.label || '', { defaultValue: column.label || '' })}
                    </span>
                  )}

                  {/* Column Resize Handle */}
                  {column.id !== 'dragHandle' && column.id !== 'checkbox' && (
                    <div
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={t('resizeColumn', {
                        defaultValue: 'Resize {{column}} column',
                        column: t(column.label || '', { defaultValue: column.label || '' }),
                      })}
                      tabIndex={0}
                      className="column-resize-handle"
                      style={{
                        position: 'absolute',
                        top: 0,
                        right: -4,
                        width: 8,
                        height: '100%',
                      }}
                      onKeyDown={e => handleResizeKeyDown(e, column)}
                      onMouseDown={e => handleResizeMouseDown(e, column)}
                      onClick={e => e.stopPropagation()}
                      title={t('resizeColumn', {
                        defaultValue: 'Resize {{column}} column',
                        column: t(column.label || '', { defaultValue: column.label || '' }),
                      })}
                    />
                  )}
                </div>
              );

              if (column.isSticky) {
                return <React.Fragment key={column.id}>{headerContent()}</React.Fragment>;
              }

              return (
                <SortableHeader key={column.id} column={column} isDropTarget={isDropTarget}>
                  {({ attributes, listeners, setActivatorNodeRef, isDragging }) =>
                    headerContent({ attributes, listeners, setActivatorNodeRef, isDragging })
                  }
                </SortableHeader>
              );
            })}
            {/* Add Custom Column Button - positioned at the end and scrolls with content */}
            {!isBacklogMode && (
              <div
                className="flex items-center justify-center px-2 border-r border-gray-200 dark:border-gray-700"
                style={{ width: '50px', flexShrink: 0 }}
              >
                <AddCustomColumnButton />
              </div>
            )}
          </div>
        </div>
      </SortableContext>
    </DndContext>
  );
  return isTaskListProfilingEnabled ? (
    <React.Profiler id="table-header" onRender={recordTaskListRender}>
      {header}
    </React.Profiler>
  ) : (
    header
  );
});

TaskListColumnHeaders.displayName = 'TaskListColumnHeaders';

const SortableHeader: React.FC<{
  column: ColumnConfig;
  isDropTarget: boolean;
  children: (params: {
    attributes: ReturnType<typeof useSortable>['attributes'];
    listeners: ReturnType<typeof useSortable>['listeners'];
    setActivatorNodeRef: (element: HTMLElement | null) => void;
    isDragging: boolean;
  }) => React.ReactNode;
}> = React.memo(({ column, isDropTarget, children }) => {
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
    // Disable the automatic scaling that dnd-kit applies during drag
    animateLayoutChanges: () => false,
  });

  // Get the actual pixel width from the column object, not CSS variable
  const explicitWidth = column.width; // This is already a string like "120px"

  // Remove scale from transform to prevent width changes during drag
  const transformWithoutScale = transform
    ? {
        ...transform,
        scaleX: 1,
        scaleY: 1,
      }
    : null;

  const style = {
    transform: transformWithoutScale ? CSS.Transform.toString(transformWithoutScale) : undefined,
    transition,
    zIndex: isDragging ? 25 : undefined,
    willChange: isDragging ? 'transform' : undefined,
    // Use explicit pixel width, not CSS variable, to prevent width changes during drag
    width: explicitWidth,
    minWidth: explicitWidth,
    maxWidth: explicitWidth,
    flexShrink: 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-column-id={column.id}
      className={isDropTarget ? 'column-drop-target' : undefined}
    >
      {children({ attributes, listeners, setActivatorNodeRef, isDragging })}
    </div>
  );
});
