import { Progress, Tooltip } from '@/shared/antd-imports';
import './task-row-progress.css';
import React from 'react';

type TaskRowProgressProps = {
  progress: number;
  numberOfSubTasks: number;
};

const TaskRowProgress = React.memo(
  ({ progress = 0, numberOfSubTasks = 0 }: TaskRowProgressProps) => {
    const totalTasks = numberOfSubTasks + 1;
    const completedTasks = 0;

    const size = progress === 100 ? 21 : 26;

    return (
      <Tooltip title={`${completedTasks} / ${totalTasks}`}>
        <Progress
          percent={progress}
          type="circle"
          size={size}
          style={{ cursor: 'default' }}
          className="task-progress"
        />
      </Tooltip>
    );
  }
);

export default TaskRowProgress;
