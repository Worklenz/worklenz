import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getExpandedRowModel,
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
import { useTranslation } from 'react-i18next';
import { HolderOutlined } from '@ant-design/icons';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TaskListTableProps {
  tasks: IProjectTask[];
  groupId: string;
  color: string;
  onTaskSelect?: (taskId: string) => void;
}

interface SortableRowProps {
  id: string;
  children: React.ReactNode;
}

const SortableRow: React.FC<SortableRowProps> = ({ id, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr ref={setNodeRef} style={style} {...attributes}>
      <td className="w-10 cursor-move" {...listeners}>
        <HolderOutlined />
      </td>
      {children}
    </tr>
  );
};

const TaskListTable: React.FC<TaskListTableProps> = ({ tasks, groupId, color, onTaskSelect }) => {
  const { t } = useTranslation();
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

  // Column definitions
  const columns = useMemo<ColumnDef<IProjectTask>[]>(() => [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllRowsSelected()}
          indeterminate={table.getIsSomeRowsSelected()}
          onChange={table.getToggleAllRowsSelectedHandler()}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          indeterminate={row.getIsSomeSelected()}
          onChange={row.getToggleSelectedHandler()}
        />
      ),
    },
    {
      id: 'task',
      header: t('Task'),
      accessorKey: 'name',
      cell: ({ row }) => {
        const task = row.original;
        const indent = task.is_sub_task ? 24 : 0;
        return (
          <div style={{ paddingLeft: indent }}>
            {task.name}
          </div>
        );
      },
    },
    {
      id: 'status',
      header: t('Status'),
      accessorKey: 'status',
      cell: ({ row }) => {
        const task = row.original;
        return (
          <div style={{ backgroundColor: task.status_color }}>
            {task.status}
          </div>
        );
      },
    },
    {
      id: 'priority',
      header: t('Priority'),
      accessorKey: 'priority',
      cell: ({ row }) => {
        const task = row.original;
        return (
          <div style={{ backgroundColor: task.priority_color }}>
            {task.priority}
          </div>
        );
      },
    },
    {
      id: 'assignees',
      header: t('Assignees'),
      accessorKey: 'assignees',
      cell: ({ row }) => {
        const task = row.original;
        return (
          <div>
            {task.assignees?.map(assignee => (
              <span key={assignee.id}>{assignee.name}</span>
            ))}
          </div>
        );
      },
    },
    {
      id: 'due_date',
      header: t('Due Date'),
      accessorKey: 'end_date',
      cell: ({ row }) => {
        const task = row.original;
        return task.end_date ? new Date(task.end_date).toLocaleDateString() : '-';
      },
    },
  ], [t]);

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
                  <th className="w-10"></th>
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
                  <SortableRow
                    key={row.id}
                    id={row.original.id}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </SortableRow>
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