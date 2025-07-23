import { useCallback, useMemo, useRef, useState } from 'react';
import { Checkbox, theme } from '@/shared/antd-imports';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  VisibilityState,
  Row,
  Column,
} from '@tanstack/react-table';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { useAppSelector } from '@/hooks/useAppSelector';
import React from 'react';
import './task-list-custom.css';
import TaskListInstantTaskInput from './task-list-instant-task-input/task-list-instant-task-input';
import { useAuthService } from '@/hooks/useAuth';
import { createColumns } from './task-list-columns/task-list-columns';

interface TaskListCustomProps {
  tasks: IProjectTask[];
  color: string;
  groupId?: string | null;
  onTaskSelect?: (taskId: string) => void;
}

const TaskListCustom: React.FC<TaskListCustomProps> = ({ tasks, color, groupId, onTaskSelect }) => {
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const statuses = useAppSelector(state => state.taskStatusReducer.status);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const { token } = theme.useToken();
  const { getCurrentSession } = useAuthService();

  const handleExpandClick = useCallback((rowId: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [rowId]: !prev[rowId],
    }));
  }, []);

  const handleTaskSelect = useCallback(
    (taskId: string) => {
      onTaskSelect?.(taskId);
    },
    [onTaskSelect]
  );

  const columns = useMemo(
    () =>
      createColumns({
        expandedRows,
        statuses,
        handleTaskSelect,
        getCurrentSession,
      }),
    [expandedRows, statuses, handleTaskSelect, getCurrentSession]
  );

  const table = useReactTable({
    data: tasks,
    columns,
    state: {
      rowSelection,
      columnVisibility,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const { rows } = table.getRowModel();

  const columnToggleItems = columns.map(column => ({
    key: column.id as string,
    label: (
      <span>
        <Checkbox checked={table.getColumn(column.id as string)?.getIsVisible()}>
          {typeof column.header === 'string' ? column.header : column.id}
        </Checkbox>
      </span>
    ),
    onClick: () => {
      const columnData = table.getColumn(column.id as string);
      if (columnData) {
        columnData.toggleVisibility();
      }
    },
  }));

  return (
    <div
      className="task-list-custom"
      style={{
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderLeft: `4px solid ${color}`,
      }}
    >
      <div
        ref={tableContainerRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowX: 'auto',
          overflowY: 'auto',
          maxHeight: '100%',
        }}
      >
        <div style={{ width: 'fit-content', borderCollapse: 'collapse' }}>
          <div className="table-header">
            {table.getHeaderGroups().map(headerGroup => (
              <div key={headerGroup.id} className="table-row">
                {headerGroup.headers.map((header, index) => (
                  <div
                    key={header.id}
                    className={`${header.column.getIsPinned() === 'left' ? 'sticky left-0 z-10' : ''}`}
                    style={{
                      width: header.getSize(),
                      position: index < 2 ? 'sticky' : 'relative',
                      left: index === 0 ? 0 : index === 1 ? '47px' : 'auto',
                      background: token.colorBgElevated,
                      zIndex: 1,
                      color: token.colorText,
                      height: '40px',
                      borderTop: `1px solid ${token.colorBorderSecondary}`,
                      borderBottom: `1px solid ${token.colorBorderSecondary}`,
                      borderRight: `1px solid ${token.colorBorderSecondary}`,
                      textAlign: index === 0 ? 'right' : 'left',
                      fontWeight: 'normal',
                      padding: '8px 0px 8px 8px',
                    }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="table-body">
            {rows.map(row => (
              <React.Fragment key={row.id}>
                <div
                  className="table-row"
                  style={{
                    '&:hover div': {
                      background: `${token.colorFillAlter} !important`,
                    },
                  }}
                >
                  {row.getVisibleCells().map((cell, index) => (
                    <div
                      key={cell.id}
                      className={`${cell.column.getIsPinned() === 'left' ? 'sticky left-0 z-10' : ''}`}
                      style={{
                        width: cell.column.getSize(),
                        position: index < 2 ? 'sticky' : 'relative',
                        left: 'auto',
                        background: token.colorBgContainer,
                        color: token.colorText,
                        height: '42px',
                        borderBottom: `1px solid ${token.colorBorderSecondary}`,
                        borderRight: `1px solid ${token.colorBorderSecondary}`,
                        padding: '8px 0px 8px 8px',
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  ))}
                </div>
                {expandedRows[row.id] &&
                  row.original.sub_tasks?.map(subTask => (
                    <div
                      key={subTask.task_key}
                      className="table-row"
                      style={{
                        '&:hover div': {
                          background: `${token.colorFillAlter} !important`,
                        },
                      }}
                    >
                      {columns.map((col, index) => (
                        <div
                          key={`${subTask.task_key}-${col.id}`}
                          style={{
                            width: col.getSize(),
                            position: index < 2 ? 'sticky' : 'relative',
                            left: index < 2 ? `${index * col.getSize()}px` : 'auto',
                            background: token.colorBgContainer,
                            color: token.colorText,
                            height: '42px',
                            borderBottom: `1px solid ${token.colorBorderSecondary}`,
                            borderRight: `1px solid ${token.colorBorderSecondary}`,
                            paddingLeft: index === 3 ? '32px' : '8px',
                            paddingRight: '8px',
                          }}
                        >
                          {flexRender(col.cell, {
                            getValue: () => subTask[col.id as keyof typeof subTask] ?? null,
                            row: { original: subTask } as Row<IProjectTask>,
                            column: col as Column<IProjectTask>,
                            table,
                          })}
                        </div>
                      ))}
                    </div>
                  ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
      <TaskListInstantTaskInput
        session={getCurrentSession() || null}
        groupId={groupId}
        parentTask={null}
      />
      {/* {selectedCount > 0 && (
        <Flex
          justify="space-between"
          align="center"
          style={{
            padding: '8px 16px',
            background: token.colorBgElevated,
            borderTop: `1px solid ${token.colorBorderSecondary}`,
            position: 'sticky',
            bottom: 0,
            zIndex: 2,
          }}
        >
          <span>{selectedCount} tasks selected</span>
          <Flex gap={8}>
            <Button icon={<EditOutlined />}>Edit</Button>
            <Button danger icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Flex>
        </Flex>
      )} */}
    </div>
  );
};

export default TaskListCustom;
