import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useReactTable, getCoreRowModel, getSortedRowModel, getExpandedRowModel, getPaginationRowModel, flexRender } from '@tanstack/react-table';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useVirtualizer } from '@tanstack/react-virtual';
import StatusDropdown from './components/status-dropdown';
import PriorityDropdown from './components/priority-dropdown';

interface Task {
  id: string;
  name: string;
  status?: {
    id: string;
    name: string;
    color?: string;
  };
  priority?: {
    id: string;
    name: string;
    color?: string;
  };
  // Add other task properties as needed
}

interface TaskListTableProps {
  data: Task[];
  statusOptions: Array<{ id: string; name: string; color?: string; category?: string }>;
  priorityOptions: Array<{ id: string; name: string; color?: string; value?: number }>;
  onStatusChange: (taskId: string, statusId: string) => void;
  onPriorityChange: (taskId: string, priorityId: string) => void;
}

const TaskListTable: React.FC<TaskListTableProps> = ({
  data,
  statusOptions,
  priorityOptions,
  onStatusChange,
  onPriorityChange
}) => {
  const { t } = useTranslation();

  const columns = useMemo(() => [
    {
      id: 'name',
      accessorKey: 'name',
      header: t('Task Name'),
      size: 300,
      cell: ({ row }) => (
        <div 
          style={{ 
            width: '300px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
          title={row.original.name}
        >
          {row.original.name}
        </div>
      )
    },
    {
      id: 'status',
      header: t('Status'),
      cell: ({ row }) => (
        <div style={{ width: '100%', minWidth: '150px' }}>
          <StatusDropdown
            options={statusOptions}
            value={row.original.status?.id || row.original.status}
            onChange={value => onStatusChange(row.original.id, value)}
            placeholder={t('Select Status')}
            style={{ width: '100%' }}
          />
        </div>
      )
    },
    {
      id: 'priority',
      header: t('Priority'),
      cell: ({ row }) => (
        <div style={{ width: '100%', minWidth: '160px' }}>
          <PriorityDropdown
            options={priorityOptions}
            value={row.original.priority?.id || row.original.priority}
            onChange={value => onPriorityChange(row.original.id, value)}
            placeholder={t('Select Priority')}
            style={{ width: '100%' }}
          />
        </div>
      )
    }
  ], [t, statusOptions, priorityOptions, onStatusChange, onPriorityChange]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getPaginationRowModel: getPaginationRowModel()
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  const { rows } = table.getRowModel();
  const parentRef = React.useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 45,
    overscan: 20
  });

  return (
    <div 
      ref={parentRef} 
      style={{ 
        height: '800px',
        overflow: 'auto',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
      }}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(event) => {
          // Handle drag end
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    style={{
                      padding: '16px',
                      textAlign: 'left',
                      borderBottom: '1px solid #f0f0f0',
                      backgroundColor: 'white',
                      position: 'sticky',
                      top: 0,
                      zIndex: 1,
                      fontWeight: 500,
                      fontSize: '14px',
                      color: '#1f2937'
                    }}
                  >
                    {flexRender(
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
              const row = rows[virtualRow.index];
              return (
                <tr
                  key={row.id}
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    backgroundColor: 'white',
                    transition: 'background-color 0.2s'
                  }}
                >
                  {row.getVisibleCells().map(cell => (
                    <td
                      key={cell.id}
                      style={{
                        padding: '16px',
                        borderBottom: '1px solid #f0f0f0',
                        fontSize: '14px',
                        color: '#374151'
                      }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </DndContext>
    </div>
  );
};

export default TaskListTable; 