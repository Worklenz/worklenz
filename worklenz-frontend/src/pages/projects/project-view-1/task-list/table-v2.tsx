import { useCallback, useMemo, useRef, useState } from 'react';
import { Checkbox, Flex, Tag, Tooltip } from 'antd';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAppSelector } from '@/hooks/useAppSelector';
import { ITaskListGroup } from '@/types/tasks/taskList.types';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';

const TaskListTable = ({
  taskListGroup,
  visibleColumns,
  onTaskSelect,
  onTaskExpand,
}: {
  taskListGroup: ITaskListGroup;
  tableId: string;
  visibleColumns: Array<{ key: string; width: number }>;
  onTaskSelect?: (taskId: string) => void;
  onTaskExpand?: (taskId: string) => void;
}) => {
  const [hoverRow, setHoverRow] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement | null>(null);
  const parentRef = useRef<HTMLDivElement | null>(null);
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  // Memoize all tasks including subtasks for virtualization
  const flattenedTasks = useMemo(() => {
    return taskListGroup.tasks.reduce((acc: IProjectTask[], task: IProjectTask) => {
      acc.push(task);
      if (task.sub_tasks?.length) {
        acc.push(...task.sub_tasks.map((st: any) => ({ ...st, isSubtask: true })));
      }
      return acc;
    }, []);
  }, [taskListGroup.tasks]);

  // Virtual row renderer
  const rowVirtualizer = useVirtualizer({
    count: flattenedTasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 42, // row height
    overscan: 5,
  });

  // Memoize cell render functions
  const renderCell = useCallback(
    (columnKey: string | number, task: IProjectTask, isSubtask = false) => {
      const cellContent = {
        taskId: () => {
          const key = task.task_key?.toString() || '';
          return (
            <Tooltip title={key}>
              <Tag>{key}</Tag>
            </Tooltip>
          );
        },
        task: () => (
          <Flex align="center" className="pl-2">
            {task.name}
          </Flex>
        ),
        // Add other cell renderers as needed...
      }[columnKey];

      return cellContent ? cellContent() : null;
    },
    []
  );

  // Memoize header rendering
  const TableHeader = useMemo(
    () => (
      <div className="sticky top-0 z-20 flex border-b" style={{ height: 42 }}>
        <div className="sticky left-0 z-30 w-8 bg-white dark:bg-gray-900 flex items-center justify-center">
          <Checkbox />
        </div>
        {visibleColumns.map(column => (
          <div
            key={column.key}
            className="flex items-center px-3 border-r"
            style={{ width: column.width }}
          >
            {column.key}
          </div>
        ))}
      </div>
    ),
    [visibleColumns]
  );

  // Handle scroll shadows
  const handleScroll = useCallback((e: { target: any }) => {
    const target = e.target;
    const hasHorizontalShadow = target.scrollLeft > 0;
    target.classList.toggle('show-shadow', hasHorizontalShadow);
  }, []);

  return (
    <div ref={parentRef} className="h-[400px] overflow-auto" onScroll={handleScroll}>
      {TableHeader}

      <div
        ref={tableRef}
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map(virtualRow => {
          const task = flattenedTasks[virtualRow.index];
          return (
            <div
              key={task.id}
              className="absolute top-0 left-0 flex w-full border-b hover:bg-gray-50 dark:hover:bg-gray-800"
              style={{
                height: 42,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div className="sticky left-0 z-10 w-8 flex items-center justify-center">
                {/* <Checkbox checked={task.selected} /> */}
              </div>
              {visibleColumns.map(column => (
                <div
                  key={column.key}
                  className={`flex items-center px-3 border-r ${
                    hoverRow === task.id ? 'bg-gray-50 dark:bg-gray-800' : ''
                  }`}
                  style={{ width: column.width }}
                >
                  {renderCell(column.key, task, task.is_sub_task)}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TaskListTable;
