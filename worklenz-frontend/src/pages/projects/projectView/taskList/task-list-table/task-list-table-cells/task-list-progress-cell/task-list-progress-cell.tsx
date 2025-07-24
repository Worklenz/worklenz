import React from 'react';
import { Progress, Tooltip } from '@/shared/antd-imports';
import './task-list-progress-cell.css';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { useAppSelector } from '@/hooks/useAppSelector';

type TaskListProgressCellProps = {
  task: IProjectTask;
};

const TaskListProgressCell = ({ task }: TaskListProgressCellProps) => {
  const { project } = useAppSelector(state => state.projectReducer);
  const isManualProgressEnabled =
    task.project_use_manual_progress ||
    task.project_use_weighted_progress ||
    task.project_use_time_progress;
  const isSubtask = task.is_sub_task;
  const hasManualProgress = task.manual_progress;

  // Handle different cases:
  // 1. For subtasks when manual progress is enabled, show the progress
  // 2. For parent tasks, always show progress
  // 3. For subtasks when manual progress is not enabled, don't show progress (null)

  if (isSubtask && !isManualProgressEnabled) {
    return null; // Don't show progress for subtasks when manual progress is disabled
  }

  // For parent tasks, show completion ratio with task count tooltip
  if (!isSubtask) {
    return (
      <Tooltip title={`${task.completed_count || 0} / ${task.total_tasks_count || 0}`}>
        <Progress
          percent={task.complete_ratio || 0}
          type="circle"
          size={24}
          style={{ cursor: 'default' }}
          strokeWidth={(task.complete_ratio || 0) >= 100 ? 9 : 7}
        />
      </Tooltip>
    );
  }

  // For subtasks with manual progress enabled, show the progress
  return (
    <Tooltip
      title={hasManualProgress ? `Manual: ${task.progress_value || 0}%` : `${task.progress || 0}%`}
    >
      <Progress
        percent={hasManualProgress ? task.progress_value || 0 : task.progress || 0}
        type="circle"
        size={22} // Slightly smaller for subtasks
        style={{ cursor: 'default' }}
        strokeWidth={(task.progress || 0) >= 100 ? 9 : 7}
      />
    </Tooltip>
  );
};

export default TaskListProgressCell;
