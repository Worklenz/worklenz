import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  flexRender,
  VisibilityState,
  ColumnDef,
  Row,
  Column,
  ExpandedState,
} from '@tanstack/react-table';
import { DndContext, DragEndEvent, DragStartEvent, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Checkbox, theme } from 'antd';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch';
import { 
  reorderTasks,
  toggleColumnVisibility,
  updateCustomColumnPinned,
  addCustomColumn,
  deleteCustomColumn,
  toggleTaskRowExpansion,
} from '@/features/tasks/tasks.slice';
import { COLUMN_KEYS } from '@/features/tasks/tasks.slice';

interface TaskListTableProps {
  tasks: IProjectTask[];
  groupId: string;
  color: string;
  onTaskSelect?: (taskId: string) => void;
}

const TaskListTable: React.FC<TaskListTableProps> = ({ tasks, groupId, color, onTaskSelect }) => {
  const dispatch = useAppDispatch();
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const { token } = theme.useToken();

  // DnD setup
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = tasks.findIndex(task => task.id === active.id);
      const newIndex = tasks.findIndex(task => task.id === over.id);
      
      dispatch(reorderTasks({
        activeGroupId: groupId,
        overGroupId: groupId,
        fromIndex: oldIndex,
        toIndex: newIndex,
        task: tasks[oldIndex],
        updatedSourceTasks: [...tasks],
        updatedTargetTasks: [...tasks],
      }));
    }
    setActiveId(null);
  };

  // Virtualization setup
  const rowVirtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 50, // Estimated row height
    overscan: 5,
  });

  // Column definitions will be added here
  const columns = useMemo<ColumnDef<IProjectTask>[]>(() => [
    // Column definitions will be added in the next step
  ], []);

  const table = useReactTable({
    data: tasks,
    columns,
    state: {
      rowSelection,
      columnVisibility,
      expanded,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  return (
    <div className="task-list-table" ref={tableContainerRef}>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis]}
      >
        <SortableContext
          items={tasks.map(task => task.id)}
          strategy={verticalListSortingStrategy}
        >
          <table className="w-full">
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {rowVirtualizer.getVirtualItems().map(virtualRow => {
                const row = table.getRowModel().rows[virtualRow.index];
                return (
                  <tr
                    key={row.id}
                    data-index={virtualRow.index}
                    ref={virtualRow.index === 0 ? rowVirtualizer.measureElement : undefined}
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default TaskListTable; 