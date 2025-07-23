import { useCallback, useMemo, useRef, useState } from 'react';
import { Checkbox, Flex, Tag, Tooltip } from '@/shared/antd-imports';
import { HolderOutlined } from '@/shared/antd-imports';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  KeyboardSensor,
  TouchSensor,
  UniqueIdentifier,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useSocket } from '@/socket/socketContext';
import { useAuthService } from '@/hooks/useAuth';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { ITaskListGroup } from '@/types/tasks/taskList.types';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { SocketEvents } from '@/shared/socket-events';
import { reorderTasks } from '@/features/tasks/tasks.slice';
import { evt_project_task_list_drag_and_move } from '@/shared/worklenz-analytics-events';

// Draggable Row Component
interface DraggableRowProps {
  task: IProjectTask;
  visibleColumns: Array<{ key: string; width: number }>;
  renderCell: (
    columnKey: string | number,
    task: IProjectTask,
    isSubtask?: boolean
  ) => React.ReactNode;
  hoverRow: string | null;
  onRowHover: (taskId: string | null) => void;
  isSubtask?: boolean;
}

const DraggableRow = ({
  task,
  visibleColumns,
  renderCell,
  hoverRow,
  onRowHover,
  isSubtask = false,
}: DraggableRowProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id as UniqueIdentifier,
    data: {
      type: 'task',
      task,
    },
    disabled: isSubtask, // Disable drag for subtasks
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex w-full border-b hover:bg-gray-50 dark:hover:bg-gray-800"
      onMouseEnter={() => onRowHover(task.id)}
      onMouseLeave={() => onRowHover(null)}
    >
      <div className="sticky left-0 z-10 w-8 flex items-center justify-center">
        {!isSubtask && (
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
            <HolderOutlined />
          </div>
        )}
      </div>
      {visibleColumns.map(column => (
        <div
          key={column.key}
          className={`flex items-center px-3 border-r ${
            hoverRow === task.id ? 'bg-gray-50 dark:bg-gray-800' : ''
          }`}
          style={{ width: column.width }}
        >
          {renderCell(column.key, task, isSubtask)}
        </div>
      ))}
    </div>
  );
};

const TaskListTable = ({
  taskListGroup,
  tableId,
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
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const tableRef = useRef<HTMLDivElement | null>(null);
  const parentRef = useRef<HTMLDivElement | null>(null);

  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { projectId } = useAppSelector(state => state.projectReducer);
  const groupBy = useAppSelector(state => state.taskReducer.groupBy);

  const dispatch = useAppDispatch();
  const { socket } = useSocket();
  const currentSession = useAuthService().getCurrentSession();
  const { trackMixpanelEvent } = useMixpanelTracking();

  // Configure sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  // Memoize all tasks including subtasks
  const flattenedTasks = useMemo(() => {
    return taskListGroup.tasks.reduce((acc: IProjectTask[], task: IProjectTask) => {
      acc.push(task);
      if (task.sub_tasks?.length) {
        acc.push(...task.sub_tasks.map((st: any) => ({ ...st, isSubtask: true })));
      }
      return acc;
    }, []);
  }, [taskListGroup.tasks]);

  // Get only main tasks for sortable context (exclude subtasks)
  const mainTasks = useMemo(() => {
    return taskListGroup.tasks.filter(task => !task.isSubtask);
  }, [taskListGroup.tasks]);

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
          <Flex align="center" className={isSubtask ? 'pl-6' : 'pl-2'}>
            {task.name}
          </Flex>
        ),
        // Add other cell renderers as needed...
      }[columnKey];

      return cellContent ? cellContent() : null;
    },
    []
  );

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id);
    document.body.style.cursor = 'grabbing';
  }, []);

  // Handle drag end with socket integration
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      setActiveId(null);
      document.body.style.cursor = '';

      if (!over || active.id === over.id) {
        return;
      }

      const activeIndex = mainTasks.findIndex(task => task.id === active.id);
      const overIndex = mainTasks.findIndex(task => task.id === over.id);

      if (activeIndex !== -1 && overIndex !== -1) {
        const activeTask = mainTasks[activeIndex];
        const overTask = mainTasks[overIndex];

        // Create updated task arrays
        const updatedTasks = [...mainTasks];
        updatedTasks.splice(activeIndex, 1);
        updatedTasks.splice(overIndex, 0, activeTask);

        // Dispatch Redux action for optimistic update
        dispatch(
          reorderTasks({
            activeGroupId: tableId,
            overGroupId: tableId,
            fromIndex: activeIndex,
            toIndex: overIndex,
            task: activeTask,
            updatedSourceTasks: updatedTasks,
            updatedTargetTasks: updatedTasks,
          })
        );

        // Emit socket event for backend persistence
        if (socket && projectId && currentSession?.team_id) {
          const toPos = overTask?.sort_order || mainTasks[mainTasks.length - 1]?.sort_order || -1;

          socket.emit(SocketEvents.TASK_SORT_ORDER_CHANGE.toString(), {
            project_id: projectId,
            from_index: activeTask.sort_order,
            to_index: toPos,
            to_last_index: overIndex === mainTasks.length - 1,
            from_group: tableId,
            to_group: tableId,
            group_by: groupBy,
            task: activeTask,
            team_id: currentSession.team_id,
          });

          // Track analytics event
          trackMixpanelEvent(evt_project_task_list_drag_and_move);
        }
      }
    },
    [
      mainTasks,
      tableId,
      dispatch,
      socket,
      projectId,
      currentSession?.team_id,
      groupBy,
      trackMixpanelEvent,
    ]
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

  // Find active task for drag overlay
  const activeTask = activeId ? flattenedTasks.find(task => task.id === activeId) : null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div ref={parentRef} className="h-[400px] overflow-auto" onScroll={handleScroll}>
        {TableHeader}

        <SortableContext
          items={mainTasks.map(task => task.id)}
          strategy={verticalListSortingStrategy}
        >
          <div ref={tableRef} style={{ width: '100%' }}>
            {flattenedTasks.map((task, index) => (
              <DraggableRow
                key={task.id}
                task={task}
                visibleColumns={visibleColumns}
                renderCell={renderCell}
                hoverRow={hoverRow}
                onRowHover={setHoverRow}
                isSubtask={task.isSubtask}
              />
            ))}
          </div>
        </SortableContext>
      </div>

      <DragOverlay
        dropAnimation={{
          duration: 200,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        }}
      >
        {activeTask && (
          <div className="bg-white dark:bg-gray-800 shadow-lg rounded-sm border">
            <DraggableRow
              task={activeTask}
              visibleColumns={visibleColumns}
              renderCell={renderCell}
              hoverRow={null}
              onRowHover={() => {}}
              isSubtask={activeTask.isSubtask}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
};

export default TaskListTable;
