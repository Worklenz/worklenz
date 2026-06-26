import { Progress, Tooltip } from '@/shared/antd-imports';
import React from 'react';
import './TaskProgress.css';

type TaskProgressProps = {
  progress: number;
  numberOfSubTasks: number;
};

const TaskProgress = ({ progress = 0, numberOfSubTasks = 0 }: TaskProgressProps) => {
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
};

export default TaskProgress;
