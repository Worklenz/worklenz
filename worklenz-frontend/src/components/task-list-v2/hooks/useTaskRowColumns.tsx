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
  PhaseColumn,
  TimeTrackingColumn,
  EstimationColumn,
  DateColumn,
  ReporterColumn,
  CustomColumn,
} from '../components/TaskRowColumns';
import { TitleColumn } from '../components/TitleColumn';
import { DatePickerColumn } from '../components/DatePickerColumn';

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
  updateTaskCustomColumnValue?: (taskId: string, columnKey: string, value: string) => void;
  
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
  
  // Drag and drop
  attributes: any;
  listeners: any;
  
  // Depth for nested subtasks
  depth?: number;
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
  attributes,
  listeners,
  depth = 0,
}: UseTaskRowColumnsProps) => {
  
  const renderColumn = useCallback((columnId: string, width: string, isSticky?: boolean, index?: number) => {
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
        return (
          <TaskKeyColumn
            width={width}
            taskKey={task.task_key || ''}
          />
        );

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
            onTaskNameChange={setTaskName}
            onTaskNameSave={handleTaskNameSave}
            depth={depth}
          />
        );

      case 'description':
        return (
          <DescriptionColumn
            width={width}
            description={task.description || ''}
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

      case 'progress':
        return (
          <ProgressColumn
            width={width}
            task={task}
          />
        );

      case 'labels':
        return (
          <LabelsColumn
            width={width}
            task={task}
            labelsAdapter={labelsAdapter}
            isDarkMode={isDarkMode}
            visibleColumns={visibleColumns}
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
          <TimeTrackingColumn
            width={width}
            taskId={task.id || ''}
            isDarkMode={isDarkMode}
          />
        );

      case 'estimation':
        return (
          <EstimationColumn
            width={width}
            task={task}
          />
        );

      case 'completedDate':
        return (
          <DateColumn
            width={width}
            formattedDate={formattedDates.completed}
          />
        );

      case 'createdDate':
        return (
          <DateColumn
            width={width}
            formattedDate={formattedDates.created}
          />
        );

      case 'lastUpdated':
        return (
          <DateColumn
            width={width}
            formattedDate={formattedDates.updated}
          />
        );

      case 'reporter':
        return (
          <ReporterColumn
            width={width}
            reporter={task.reporter || ''}
          />
        );

      default:
        // Handle custom columns
        const column = visibleColumns.find(col => col.id === columnId);
        if (column && (column.custom_column || column.isCustom) && updateTaskCustomColumnValue) {
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
  }, [
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
  ]);

  return { renderColumn };
}; 