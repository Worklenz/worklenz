import React, { memo } from 'react';
import { CheckCircleOutlined, HolderOutlined } from '@/shared/antd-imports';
import { Checkbox } from '@/shared/antd-imports';
import { Task } from '@/types/task-management.types';
import AssigneeSelector from '@/components/AssigneeSelector';
import { format } from 'date-fns';
import AvatarGroup from '../../AvatarGroup';
import { DEFAULT_TASK_NAME } from '@/shared/constants';
import TaskProgress from '@/pages/projects/project-view-1/taskList/taskListTable/taskListTableCells/TaskProgress';
import TaskStatusDropdown from '@/components/task-management/task-status-dropdown';
import TaskPriorityDropdown from '@/components/task-management/task-priority-dropdown';
import TaskPhaseDropdown from '@/components/task-management/task-phase-dropdown';
import TaskTimeTracking from '../TaskTimeTracking';
import { CustomNumberLabel, CustomColordLabel } from '@/components';
import LabelsSelector from '@/components/LabelsSelector';
import { CustomColumnCell } from './CustomColumnComponents';

// Utility function to get task display name with fallbacks
export const getTaskDisplayName = (task: Task): string => {
  if (task.title && task.title.trim()) return task.title.trim();
  if (task.name && task.name.trim()) return task.name.trim();
  if (task.task_key && task.task_key.trim()) return task.task_key.trim();
  return DEFAULT_TASK_NAME;
};

// Memoized date formatter to avoid repeated date parsing
export const formatDate = (dateString: string): string => {
  try {
    return format(new Date(dateString), 'MMM d, yyyy');
  } catch {
    return '';
  }
};

interface TaskLabelsCellProps {
  labels: Task['labels'];
  isDarkMode: boolean;
}

export const TaskLabelsCell: React.FC<TaskLabelsCellProps> = memo(({ labels, isDarkMode }) => {
  if (!labels) {
    return null;
  }

  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {labels.map((label, index) => {
        const extendedLabel = label as any;
        return extendedLabel.end && extendedLabel.names && extendedLabel.name ? (
          <CustomNumberLabel
            key={`${label.id}-${index}`}
            labelList={extendedLabel.names}
            namesString={extendedLabel.name}
            isDarkMode={isDarkMode}
            color={label.color}
          />
        ) : (
          <CustomColordLabel key={`${label.id}-${index}`} label={label} isDarkMode={isDarkMode} />
        );
      })}
    </div>
  );
});

TaskLabelsCell.displayName = 'TaskLabelsCell';

interface DragHandleColumnProps {
  width: string;
  isSubtask: boolean;
  attributes: any;
  listeners: any;
}

export const DragHandleColumn: React.FC<DragHandleColumnProps> = memo(
  ({ width, isSubtask, attributes, listeners }) => (
    <div
      className="flex items-center justify-center"
      style={{ width }}
      {...(isSubtask ? {} : { ...attributes, ...listeners })}
    >
      {!isSubtask && <HolderOutlined className="text-gray-400 hover:text-gray-600" />}
    </div>
  )
);

DragHandleColumn.displayName = 'DragHandleColumn';

interface CheckboxColumnProps {
  width: string;
  isSelected: boolean;
  onCheckboxChange: (e: any) => void;
}

export const CheckboxColumn: React.FC<CheckboxColumnProps> = memo(
  ({ width, isSelected, onCheckboxChange }) => (
    <div className="flex items-center justify-center dark:border-gray-700" style={{ width }}>
      <Checkbox
        checked={isSelected}
        onChange={onCheckboxChange}
        onClick={e => e.stopPropagation()}
      />
    </div>
  )
);

CheckboxColumn.displayName = 'CheckboxColumn';

interface TaskKeyColumnProps {
  width: string;
  taskKey: string;
}

export const TaskKeyColumn: React.FC<TaskKeyColumnProps> = memo(({ width, taskKey }) => (
  <div
    className="flex items-center pl-3 border-r border-gray-200 dark:border-gray-700"
    style={{ width }}
  >
    <span className="text-xs font-medium px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 whitespace-nowrap border border-gray-200 dark:border-gray-600">
      {taskKey || 'N/A'}
    </span>
  </div>
));

TaskKeyColumn.displayName = 'TaskKeyColumn';

interface DescriptionColumnProps {
  width: string;
  description: string;
}

export const DescriptionColumn: React.FC<DescriptionColumnProps> = memo(
  ({ width, description }) => (
    <div
      className="flex items-center px-2 border-r border-gray-200 dark:border-gray-700"
      style={{ width }}
    >
      <div
        className="text-sm text-gray-600 dark:text-gray-400 truncate w-full"
        style={{
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxHeight: '24px',
          lineHeight: '24px',
        }}
        title={description || ''}
        dangerouslySetInnerHTML={{ __html: description || '' }}
      />
    </div>
  )
);

DescriptionColumn.displayName = 'DescriptionColumn';

interface StatusColumnProps {
  width: string;
  task: Task;
  projectId: string;
  isDarkMode: boolean;
}

export const StatusColumn: React.FC<StatusColumnProps> = memo(
  ({ width, task, projectId, isDarkMode }) => (
    <div
      className="flex items-center justify-center px-2 border-r border-gray-200 dark:border-gray-700"
      style={{ width }}
    >
      <TaskStatusDropdown task={task} projectId={projectId} isDarkMode={isDarkMode} />
    </div>
  )
);

StatusColumn.displayName = 'StatusColumn';

interface AssigneesColumnProps {
  width: string;
  task: Task;
  convertedTask: any;
  isDarkMode: boolean;
}

export const AssigneesColumn: React.FC<AssigneesColumnProps> = memo(
  ({ width, task, convertedTask, isDarkMode }) => (
    <div
      className="flex items-center gap-1 px-2 border-r border-gray-200 dark:border-gray-700"
      style={{ width }}
    >
      <AvatarGroup
        members={task.assignee_names || []}
        maxCount={3}
        isDarkMode={isDarkMode}
        size={24}
      />
      <AssigneeSelector task={convertedTask} groupId={null} isDarkMode={isDarkMode} />
    </div>
  )
);

AssigneesColumn.displayName = 'AssigneesColumn';

interface PriorityColumnProps {
  width: string;
  task: Task;
  projectId: string;
  isDarkMode: boolean;
}

export const PriorityColumn: React.FC<PriorityColumnProps> = memo(
  ({ width, task, projectId, isDarkMode }) => (
    <div
      className="flex items-center justify-center px-2 border-r border-gray-200 dark:border-gray-700"
      style={{ width }}
    >
      <TaskPriorityDropdown task={task} projectId={projectId} isDarkMode={isDarkMode} />
    </div>
  )
);

PriorityColumn.displayName = 'PriorityColumn';

interface ProgressColumnProps {
  width: string;
  task: Task;
}

export const ProgressColumn: React.FC<ProgressColumnProps> = memo(({ width, task }) => (
  <div
    className="flex items-center justify-center px-2 border-r border-gray-200 dark:border-gray-700"
    style={{ width }}
  >
    {task.progress !== undefined &&
      task.progress >= 0 &&
      (task.progress === 100 ? (
        <div className="flex items-center justify-center">
          <CheckCircleOutlined
            className="text-green-500"
            style={{
              fontSize: '20px',
              color: '#52c41a',
            }}
          />
        </div>
      ) : (
        <TaskProgress progress={task.progress} numberOfSubTasks={task.sub_tasks?.length || 0} />
      ))}
  </div>
));

ProgressColumn.displayName = 'ProgressColumn';

interface LabelsColumnProps {
  width: string;
  task: Task;
  labelsAdapter: any;
  isDarkMode: boolean;
  visibleColumns: any[];
}

export const LabelsColumn: React.FC<LabelsColumnProps> = memo(
  ({ width, task, labelsAdapter, isDarkMode, visibleColumns }) => {
    const labelsStyle = {
      width,
      flexShrink: 0,
    };

    return (
      <div
        className="flex items-center gap-0.5 flex-wrap min-w-0 px-2 border-r border-gray-200 dark:border-gray-700"
        style={labelsStyle}
      >
        <TaskLabelsCell labels={task.labels} isDarkMode={isDarkMode} />
        <LabelsSelector task={labelsAdapter} isDarkMode={isDarkMode} />
      </div>
    );
  }
);

LabelsColumn.displayName = 'LabelsColumn';

interface PhaseColumnProps {
  width: string;
  task: Task;
  projectId: string;
  isDarkMode: boolean;
}

export const PhaseColumn: React.FC<PhaseColumnProps> = memo(
  ({ width, task, projectId, isDarkMode }) => (
    <div
      className="flex items-center justify-center px-2 border-r border-gray-200 dark:border-gray-700"
      style={{ width }}
    >
      <TaskPhaseDropdown task={task} projectId={projectId} isDarkMode={isDarkMode} />
    </div>
  )
);

PhaseColumn.displayName = 'PhaseColumn';

interface TimeTrackingColumnProps {
  width: string;
  taskId: string;
  isDarkMode: boolean;
}

export const TimeTrackingColumn: React.FC<TimeTrackingColumnProps> = memo(
  ({ width, taskId, isDarkMode }) => (
    <div
      className="flex items-center justify-center px-2 border-r border-gray-200 dark:border-gray-700"
      style={{ width }}
    >
      <TaskTimeTracking taskId={taskId} isDarkMode={isDarkMode} />
    </div>
  )
);

TimeTrackingColumn.displayName = 'TimeTrackingColumn';

interface EstimationColumnProps {
  width: string;
  task: Task;
}

export const EstimationColumn: React.FC<EstimationColumnProps> = memo(({ width, task }) => {
  const estimationDisplay = (() => {
    const estimatedHours = task.timeTracking?.estimated;

    if (estimatedHours && estimatedHours > 0) {
      const hours = Math.floor(estimatedHours);
      const minutes = Math.round((estimatedHours - hours) * 60);

      if (hours > 0 && minutes > 0) {
        return `${hours}h ${minutes}m`;
      } else if (hours > 0) {
        return `${hours}h`;
      } else if (minutes > 0) {
        return `${minutes}m`;
      }
    }

    return null;
  })();

  return (
    <div
      className="flex items-center justify-center px-2 border-r border-gray-200 dark:border-gray-700"
      style={{ width }}
    >
      {estimationDisplay ? (
        <span className="text-sm text-gray-500 dark:text-gray-400">{estimationDisplay}</span>
      ) : (
        <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
      )}
    </div>
  );
});

EstimationColumn.displayName = 'EstimationColumn';

interface DateColumnProps {
  width: string;
  formattedDate: string | null;
  placeholder?: string;
}

export const DateColumn: React.FC<DateColumnProps> = memo(
  ({ width, formattedDate, placeholder = '-' }) => (
    <div
      className="flex items-center justify-center px-2 border-r border-gray-200 dark:border-gray-700"
      style={{ width }}
    >
      {formattedDate ? (
        <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
          {formattedDate}
        </span>
      ) : (
        <span className="text-sm text-gray-400 dark:text-gray-500 whitespace-nowrap">
          {placeholder}
        </span>
      )}
    </div>
  )
);

DateColumn.displayName = 'DateColumn';

interface ReporterColumnProps {
  width: string;
  reporter: string;
}

export const ReporterColumn: React.FC<ReporterColumnProps> = memo(({ width, reporter }) => (
  <div
    className="flex items-center justify-center px-2 border-r border-gray-200 dark:border-gray-700"
    style={{ width }}
  >
    {reporter ? (
      <span className="text-sm text-gray-500 dark:text-gray-400 truncate" title={reporter}>
        {reporter}
      </span>
    ) : (
      <span className="text-sm text-gray-400 dark:text-gray-500 whitespace-nowrap">-</span>
    )}
  </div>
));

ReporterColumn.displayName = 'ReporterColumn';

interface CustomColumnProps {
  width: string;
  column: any;
  task: Task;
  updateTaskCustomColumnValue?: (taskId: string, columnKey: string, value: string) => void;
}

export const CustomColumn: React.FC<CustomColumnProps> = memo(
  ({ width, column, task, updateTaskCustomColumnValue }) => {
    if (!updateTaskCustomColumnValue) return null;

    return (
      <div
        className="flex items-center justify-center px-2 border-r border-gray-200 dark:border-gray-700"
        style={{ width }}
      >
        <CustomColumnCell
          column={column}
          task={task}
          updateTaskCustomColumnValue={updateTaskCustomColumnValue}
        />
      </div>
    );
  }
);

CustomColumn.displayName = 'CustomColumn';
