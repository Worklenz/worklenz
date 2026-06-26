import React, { useCallback } from 'react';
import { Task } from '@/types/task-management.types';
import {
  DragHandleColumn,
  CheckboxColumn,
  TaskKeyColumn,
  DescriptionColumn,
  StatusColumn,
  AssigneesColumn,
  PriorityColumn,
  ProgressColumn,
  LabelsColumn,
  LabelsColumnWithOverflow,
  PhaseColumn,
  TimeTrackingColumn,
  EstimationColumn,
  DateColumn,
  ReporterColumn,
  CustomColumn,
} from '../components/TaskRowColumns';
import { TitleColumn } from '../components/TitleColumn';
import { DatePickerColumn } from '../components/DatePickerColumn';
import TaskListDueTimeCell from '@/pages/projects/projectView/taskList/task-list-table/task-list-table-cells/task-list-due-time-cell/task-list-due-time-cell';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { selectGroups } from '@/features/task-management/task-management.slice';
import {
  fetchTask as fetchTaskDrawer,
  setNavigationContext,
  setSelectedTaskId,
  setShowTaskDrawer,
} from '@/features/task-drawer/task-drawer.slice';

interface UseTaskRowColumnsProps {
  task: Task;
  projectId: string;
  isSubtask: boolean;
  isSelected: boolean;
  isDarkMode: boolean;
  visibleColumns: Array<{
    id: string;
    width: string;
    isSticky?: boolean;
    key?: string;
    custom_column?: boolean;
    custom_column_obj?: any;
    isCustom?: boolean;
  }>;
  updateTaskCustomColumnValue?: (taskId: string, columnKey: string, value: string| number | boolean | string[] | null) => void;

  // From useTaskRowState
  taskDisplayName: string;
  convertedTask: any;
  formattedDates: any;
  dateValues: any;
  labelsAdapter: any;
  activeDatePicker: string | null;
  setActiveDatePicker: (field: string | null) => void;
  editTaskName: boolean;
  taskName: string;
  setEditTaskName: (editing: boolean) => void;
  setTaskName: (name: string) => void;

  // From useTaskRowActions
  handleCheckboxChange: (e: any) => void;
  handleTaskNameSave: () => void;
  handleTaskNameEdit: () => void;
  handleTaskNameChangeLive: (name: string) => void;
  handleCancelEdit: () => void;

  // Drag and drop
  attributes: any;
  listeners: any;

  // Depth for nested subtasks
  depth?: number;

  // Task creation/assignment restriction
  canCreateTask?: boolean;
}

export const useTaskRowColumns = ({
  task,
  projectId,
  isSubtask,
  isSelected,
  isDarkMode,
  visibleColumns,
  updateTaskCustomColumnValue,
  taskDisplayName,
  convertedTask,
  formattedDates,
  dateValues,
  labelsAdapter,
  activeDatePicker,
  setActiveDatePicker,
  editTaskName,
  taskName,
  setEditTaskName,
  setTaskName,
  handleCheckboxChange,
  handleTaskNameSave,
  handleTaskNameEdit,
  handleTaskNameChangeLive,
  handleCancelEdit,
  attributes,
  listeners,
  depth = 0,
  canCreateTask = true,
}: UseTaskRowColumnsProps) => {
  const dispatch = useAppDispatch();
  const groups = useAppSelector(selectGroups);

  // Opens the task drawer — used by DescriptionColumn when rich formatting
  // is present and inline plain-text editing would destroy it.
  const openDrawerForTask = useCallback(() => {
    if (!task.id || !projectId) return;
    const taskIds = groups.flatMap(g => g.taskIds);
    const currentIndex = taskIds.indexOf(task.id);
    dispatch(
      setNavigationContext({
        taskIds,
        currentIndex: currentIndex >= 0 ? currentIndex : 0,
        sourceView: 'task-list',
        projectId,
      })
    );
    dispatch(setSelectedTaskId(task.id));
    dispatch(setShowTaskDrawer(true));
    dispatch(fetchTaskDrawer({ taskId: task.id, projectId }));
  }, [dispatch, groups, task.id, projectId]);

  const renderColumn = useCallback(
    (
      columnId: string,
      width: string,
      isSticky?: boolean,
      index?: number,
      currentBg?: string,
      rowBackgrounds?: any
    ) => {
      // Calculate left position for sticky columns - must account for ALL previous columns
      let leftPosition = 0; // Start at 0 to cover the row's left padding
      if (isSticky && typeof index === 'number') {
        for (let i = 0; i < index; i++) {
          const prevColumn = visibleColumns[i];
          leftPosition += parseInt(prevColumn.width.replace('px', ''));
        }
      }

      // Create wrapper style for sticky positioning
      const wrapperStyle = isSticky
        ? {
            position: 'sticky' as const,
            left: leftPosition,
            zIndex: 5, // Lower than header but above regular content
            backgroundColor: currentBg || (isDarkMode ? (isSubtask ? '#141414' : '#1e1e1e') : '#ffffff'), // Use dynamic background or fallback
            width: width,
            height: '100%', // Fill the row height
            display: 'flex', // Use flex to contain child
            alignItems: 'center', // Center content vertically
          }
        : {
            width: width,
          };

      const renderColumnContent = () => {
        switch (columnId) {
          case 'dragHandle':
            return (
              <DragHandleColumn
                width={width}
                isSubtask={isSubtask}
                attributes={attributes}
                listeners={listeners}
              />
            );

          case 'checkbox':
            return (
              <CheckboxColumn
                width={width}
                isSelected={isSelected}
                onCheckboxChange={handleCheckboxChange}
              />
            );

          case 'taskKey':
            return <TaskKeyColumn width={width} taskKey={task.task_key || ''} />;

          case 'title':
            return (
              <TitleColumn
                width={width}
                task={task}
                projectId={projectId}
                isSubtask={isSubtask}
                taskDisplayName={taskDisplayName}
                editTaskName={editTaskName}
                taskName={taskName}
                onEditTaskName={setEditTaskName}
                onTaskNameChange={(name: string) => {
                  setTaskName(name);
                  handleTaskNameChangeLive(name);
                }}
                onTaskNameSave={handleTaskNameSave}
                onCancelEdit={handleCancelEdit}
                depth={depth}
                canCreateTask={canCreateTask}
              />
            );

          case 'description':
            return (
              <DescriptionColumn
                width={width}
                description={task.description || ''}
                taskId={task.id || ''}
                parentTaskId={task.parent_task_id || null}
                onOpenDrawer={openDrawerForTask}
              />
            );

          case 'status':
            return (
              <StatusColumn
                width={width}
                task={task}
                projectId={projectId}
                isDarkMode={isDarkMode}
              />
            );

          case 'assignees':
            return (
              <AssigneesColumn
                width={width}
                task={task}
                convertedTask={convertedTask}
                isDarkMode={isDarkMode}
                canCreateTask={canCreateTask}
              />
            );

          case 'priority':
            return (
              <PriorityColumn
                width={width}
                task={task}
                projectId={projectId}
                isDarkMode={isDarkMode}
              />
            );

          case 'dueDate':
            return (
              <DatePickerColumn
                width={width}
                task={task}
                field="dueDate"
                formattedDate={formattedDates.due}
                dateValue={dateValues.due}
                isDarkMode={isDarkMode}
                activeDatePicker={activeDatePicker}
                onActiveDatePickerChange={setActiveDatePicker}
              />
            );

          case 'startDate':
            return (
              <DatePickerColumn
                width={width}
                task={task}
                field="startDate"
                formattedDate={formattedDates.start}
                dateValue={dateValues.start}
                isDarkMode={isDarkMode}
                activeDatePicker={activeDatePicker}
                onActiveDatePickerChange={setActiveDatePicker}
              />
            );

          case 'dueTime':
            return (
              <div
                className="flex items-center justify-center px-2 border-r border-gray-200 dark:border-gray-700"
                style={{ width }}
              >
                <TaskListDueTimeCell task={task} />
              </div>
            );

          case 'progress':
            return <ProgressColumn width={width} task={task} />;

          case 'labels':
            return (
              <LabelsColumnWithOverflow
                width={width}
                task={task}
                labelsAdapter={labelsAdapter}
                isDarkMode={isDarkMode}
                columnId={columnId}
              />
            );

          case 'phase':
            return (
              <PhaseColumn
                width={width}
                task={task}
                projectId={projectId}
                isDarkMode={isDarkMode}
              />
            );

          case 'timeTracking':
            return (
              <TimeTrackingColumn width={width} taskId={task.id || ''} isDarkMode={isDarkMode} />
            );

          case 'estimation':
            return <EstimationColumn width={width} task={task} />;

          case 'completedDate':
            return <DateColumn width={width} formattedDate={formattedDates.completed} />;

          case 'createdDate':
            return <DateColumn width={width} formattedDate={formattedDates.created} />;

          case 'lastUpdated':
            return <DateColumn width={width} formattedDate={formattedDates.updated} />;

          case 'reporter':
            return <ReporterColumn width={width} reporter={task.reporter || ''} />;

          default:
            // Handle custom columns
            const column = visibleColumns.find(col => col.id === columnId);
            if (
              column &&
              (column.custom_column || column.isCustom) &&
              updateTaskCustomColumnValue
            ) {
              return (
                <CustomColumn
                  width={width}
                  column={column}
                  task={task}
                  updateTaskCustomColumnValue={updateTaskCustomColumnValue}
                />
              );
            }
            return null;
        }
      };

      // Wrap content with sticky positioning if needed
      const content = renderColumnContent();
      if (isSticky) {
        const hoverBg = rowBackgrounds?.hover || (isDarkMode ? '#2a2a2a' : '#f9fafb');
        return (
          <div
            data-column-id={columnId}
            style={{
              ...wrapperStyle,
              width: `var(--col-width-${columnId})`,
              // @ts-ignore - CSS custom property
              '--hover-bg': hoverBg,
            }}
            className="border-r border-gray-200 dark:border-gray-700 overflow-hidden sticky-column-hover hover:bg-[var(--hover-bg)]"
          >
            {content}
          </div>
        );
      }

      return (
        <div data-column-id={columnId} style={{ width: `var(--col-width-${columnId})` }}>
          {content}
        </div>
      );
    },
    [
      task,
      projectId,
      isSubtask,
      isSelected,
      isDarkMode,
      visibleColumns,
      updateTaskCustomColumnValue,
      taskDisplayName,
      convertedTask,
      formattedDates,
      dateValues,
      labelsAdapter,
      activeDatePicker,
      setActiveDatePicker,
      editTaskName,
      taskName,
      setEditTaskName,
      setTaskName,
      handleCheckboxChange,
      handleTaskNameSave,
      handleTaskNameEdit,
      attributes,
      listeners,
      depth,
      canCreateTask,
      openDrawerForTask,
    ]
  );

  return { renderColumn };
};