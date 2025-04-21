import { Progress, Tooltip } from 'antd';
import './task-list-progress-cell.css';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';

type TaskListProgressCellProps = {
  task: IProjectTask;
};

const TaskListProgressCell = ({ task }: TaskListProgressCellProps) => {
  return task.is_sub_task ? null : (
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
};

export default TaskListProgressCell;
